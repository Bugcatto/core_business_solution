import {
  Injectable, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  Transaction, TransactionLine, Payment,
  Item, ItemVariant, Inventory, InventoryMovement,
  PosTerminal,
} from '../database/entities/index';
import { TenantContext } from '../common/types/tenant-context.type';
import { CheckoutDto, CheckoutLineDto } from './dto/index';

@Injectable()
export class CheckoutService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
    @InjectRepository(Item)       private itemRepo: Repository<Item>,
    @InjectRepository(ItemVariant)private variantRepo: Repository<ItemVariant>,
    @InjectRepository(Inventory)  private inventoryRepo: Repository<Inventory>,
    @InjectRepository(PosTerminal)private terminalRepo: Repository<PosTerminal>,
  ) {}

  // ── Core checkout — runs entirely inside one Postgres transaction ────────────
  async checkout(ctx: TenantContext, dto: CheckoutDto): Promise<Transaction> {
    return this.dataSource.transaction(async (em) => {

      // 1. Validate POS terminal belongs to this business/branch.
      // posTerminalId is optional — when omitted, auto-resolve the first active terminal for the branch.
      const terminal = dto.posTerminalId
        ? await this.terminalRepo.findOne({
            where: { id: dto.posTerminalId, branchId: ctx.branchId, isActive: true },
          })
        : await this.terminalRepo.findOne({
            where: { branchId: ctx.branchId, isActive: true },
            order: { createdAt: 'ASC' },
          });
      if (!terminal) throw new NotFoundException('No active POS terminal found for this branch');

      // 2. Resolve all lines and validate stock
      const resolvedLines = await this.resolveLines(ctx, dto.lines);

      // 3. Calculate totals
      const subtotal = resolvedLines.reduce((sum, l) => sum + l.lineTotal, 0);
      const discountAmount = dto.discountAmount ?? 0;
      const taxAmount = this.calculateTax(subtotal - discountAmount, dto.taxRate ?? 0);
      const totalAmount = subtotal - discountAmount + taxAmount;

      // 4. Validate payment covers total
      const totalPaid = dto.payments.reduce((sum, p) => sum + p.amount, 0);
      if (totalPaid < totalAmount) {
        throw new BadRequestException(
          `Payment total (${totalPaid}) is less than transaction total (${totalAmount})`,
        );
      }

      // 5. Create transaction header
      const txn = em.create(Transaction, {
        businessId:        ctx.businessId,
        branchId:          ctx.branchId,
        posTerminalId:     terminal.id,
        contactId:         dto.contactId ?? null,
        tableId:           dto.tableId   ?? null,
        orderType:         dto.orderType ?? null,
        createdBy:         ctx.userId,
        transactionNumber: await this.generateTxnNumber(ctx.branchId),
        transactionType:   'sale',
        status:            'completed',
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount,
        notes:             dto.notes ?? null,
        completedAt:       new Date(),
      });
      await em.save(txn);

      // 6. Create transaction lines + deduct inventory atomically
      for (const line of resolvedLines) {
        await em.save(em.create(TransactionLine, {
          transactionId:       txn.id,
          itemId:              line.itemId,
          variantId:           line.variantId ?? null,
          itemNameSnapshot:    line.itemName,
          variantNameSnapshot: line.variantName ?? null,
          skuSnapshot:         line.sku ?? null,
          unitPrice:           line.unitPrice,
          quantity:            line.quantity,
          discountAmount:      line.lineDiscount,
          lineTotal:           line.lineTotal,
        }));

        // Only deduct inventory for tracked items
        if (line.trackInventory) {
          await this.deductInventory(em, ctx, txn.id, line);
        }
      }

      // 7. Record payments
      for (const p of dto.payments) {
        await em.save(em.create(Payment, {
          transactionId: txn.id,
          paymentMethod: p.method,
          amount:        p.amount,
          amountTendered:p.amountTendered ?? null,
          changeAmount:  p.amountTendered ? p.amountTendered - p.amount : null,
          status:        'completed',
          reference:     p.reference ?? null,
        }));
      }

      // 8. Emit event for post-transaction hooks (low-stock alerts, loyalty, etc.)
      this.eventEmitter.emit('transaction.completed', {
        transactionId: txn.id,
        businessId:    ctx.businessId,
        branchId:      ctx.branchId,
        lines:         resolvedLines,
      });

      return txn;
    });
  }

  // ── Inventory deduction (called per line inside the transaction) ─────────────
  private async deductInventory(
    em: any,
    ctx: TenantContext,
    transactionId: string,
    line: ResolvedLine,
  ) {
    const inv = await em.findOne(Inventory, {
      where: { branchId: ctx.branchId, itemId: line.itemId, variantId: line.variantId ?? null },
    });

    const quantityBefore = inv ? Number(inv.quantity) : 0;
    const quantityAfter  = quantityBefore - line.quantity;

    // Only block if an inventory record exists and would go negative.
    // No record = opening stock was never set → allow the sale (MVP behaviour).
    if (inv && quantityAfter < 0) {
      throw new BadRequestException(
        `Insufficient stock for "${line.itemName}". Available: ${quantityBefore}`,
      );
    }

    // Update inventory snapshot
    if (inv) {
      inv.quantity = quantityAfter;
      await em.save(inv);
    }

    // Write movement record only when an inventory record exists (opening stock was set)
    if (!inv) return;
    await em.save(em.create(InventoryMovement, {
      businessId:     ctx.businessId,
      branchId:       ctx.branchId,
      itemId:         line.itemId,
      variantId:      line.variantId ?? null,
      movementType:   'sale',
      direction:      'out',
      quantity:       line.quantity,
      quantityBefore,
      quantityAfter,
      referenceType:  'transaction',
      referenceId:    transactionId,
      status:         'approved',
      createdBy:      ctx.userId,
    }));

    // Emit low-stock event if threshold crossed
    if (inv && quantityAfter <= Number(inv.reorderLevel)) {
      this.eventEmitter.emit('inventory.low_stock', {
        businessId: ctx.businessId,
        branchId:   ctx.branchId,
        itemId:     line.itemId,
        quantity:   quantityAfter,
        reorderLevel: inv.reorderLevel,
      });
    }
  }

  // ── Line resolution — validates items, resolves prices ──────────────────────
  private async resolveLines(
    ctx: TenantContext,
    lines: CheckoutLineDto[],
  ): Promise<ResolvedLine[]> {
    const resolved: ResolvedLine[] = [];

    for (const line of lines) {
      const item = await this.itemRepo.findOne({
        where: { id: line.itemId, businessId: ctx.businessId, isActive: true },
      });
      if (!item) throw new NotFoundException(`Item ${line.itemId} not found`);

      let unitPrice = Number(item.price);
      let variantName: string | undefined;

      if (line.variantId) {
        const variant = await this.variantRepo.findOne({
          where: { id: line.variantId, itemId: item.id, isActive: true },
        });
        if (!variant) throw new NotFoundException(`Variant ${line.variantId} not found`);
        if (variant.priceOverride != null) unitPrice = Number(variant.priceOverride);
        variantName = variant.name;
      }

      // Line-level price override (manual discount by cashier)
      if (line.unitPriceOverride != null) unitPrice = line.unitPriceOverride;

      const lineDiscount = line.discountAmount ?? 0;
      const lineTotal = (unitPrice * line.quantity) - lineDiscount;

      resolved.push({
        itemId:         item.id,
        variantId:      line.variantId,
        itemName:       item.name,
        variantName,
        sku:            item.sku ?? undefined,
        unitPrice,
        quantity:       line.quantity,
        lineDiscount,
        lineTotal,
        trackInventory: item.trackInventory,
      });
    }

    return resolved;
  }

  private calculateTax(amount: number, rate: number): number {
    if (!rate) return 0;
    return Math.round(amount * (rate / 100) * 100) / 100;
  }

  private async generateTxnNumber(branchId: string): Promise<string> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.dataSource.manager.count(Transaction, {
      where: { branchId },
    });
    return `TXN-${today}-${String(count + 1).padStart(4, '0')}`;
  }
}

// ── Internal type ─────────────────────────────────────────────────────────────
interface ResolvedLine {
  itemId:         string;
  variantId?:     string;
  itemName:       string;
  variantName?:   string;
  sku?:           string;
  unitPrice:      number;
  quantity:       number;
  lineDiscount:   number;
  lineTotal:      number;
  trackInventory: boolean;
}
