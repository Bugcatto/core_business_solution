import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import {
  Transaction, TransactionLine, Payment,
  Inventory, InventoryMovement,
} from '../database/entities/index';
import { TenantContext } from '../common/types/tenant-context.type';
import { RefundDto } from './dto/index';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Transaction)     private txnRepo:     Repository<Transaction>,
    @InjectRepository(TransactionLine) private lineRepo:    Repository<TransactionLine>,
    @InjectRepository(Payment)         private paymentRepo: Repository<Payment>,
    @InjectRepository(Inventory)       private invRepo:     Repository<Inventory>,
  ) {}

  async refund(ctx: TenantContext, transactionId: string, dto: RefundDto): Promise<Transaction> {
    return this.dataSource.transaction(async (em) => {
      const original = await em.findOne(Transaction, {
        where: { id: transactionId, businessId: ctx.businessId },
      });
      if (!original) throw new NotFoundException('Transaction not found');
      if (original.status !== 'completed') {
        throw new BadRequestException('Only completed transactions can be refunded');
      }

      let refundTotal = 0;
      const refundLines: Array<{ line: TransactionLine; qty: number }> = [];

      for (const item of dto.lines) {
        const line = await em.findOne(TransactionLine, {
          where: { id: item.transactionLineId, transactionId },
        });
        if (!line) throw new NotFoundException(`Line ${item.transactionLineId} not found`);
        if (item.quantity > Number(line.quantity)) {
          throw new BadRequestException(
            `Cannot refund ${item.quantity} of "${line.itemNameSnapshot}" — only ${line.quantity} sold`,
          );
        }

        const lineRefundAmt = (Number(line.unitPrice) * item.quantity);
        refundTotal += lineRefundAmt;
        refundLines.push({ line, qty: item.quantity });
      }

      // Create the refund transaction
      const refundTxn = em.create(Transaction, {
        businessId:        ctx.businessId,
        branchId:          ctx.branchId,
        posTerminalId:     original.posTerminalId,
        contactId:         original.contactId,
        createdBy:         ctx.userId,
        transactionNumber: `REF-${original.transactionNumber}`,
        transactionType:   'refund',
        status:            'completed',
        subtotal:          -refundTotal,
        discountAmount:    0,
        taxAmount:         0,
        totalAmount:       -refundTotal,
        notes:             `Refund of ${original.transactionNumber}: ${dto.reason}`,
        completedAt:       new Date(),
      });
      await em.save(refundTxn);

      // Create refund lines + reverse inventory
      for (const { line, qty } of refundLines) {
        await em.save(em.create(TransactionLine, {
          transactionId:       refundTxn.id,
          itemId:              line.itemId,
          variantId:           line.variantId,
          itemNameSnapshot:    line.itemNameSnapshot,
          variantNameSnapshot: line.variantNameSnapshot,
          skuSnapshot:         line.skuSnapshot,
          unitPrice:           -Number(line.unitPrice),
          quantity:            qty,
          discountAmount:      0,
          lineTotal:           -(Number(line.unitPrice) * qty),
        }));

        // Return stock to inventory
        const inv = await em.findOne(Inventory, {
          where: { branchId: ctx.branchId, itemId: line.itemId, variantId: line.variantId ?? IsNull() },
        });
        const qBefore = inv ? Number(inv.quantity) : 0;
        const qAfter  = qBefore + qty;

        if (inv) { inv.quantity = qAfter; await em.save(inv); }

        await em.save(em.create(InventoryMovement, {
          businessId:    ctx.businessId,
          branchId:      ctx.branchId,
          itemId:        line.itemId,
          variantId:     line.variantId ?? null,
          movementType:  'return_in',
          direction:     'in',
          quantity:      qty,
          quantityBefore: qBefore,
          quantityAfter:  qAfter,
          referenceType: 'transaction',
          referenceId:   refundTxn.id,
          status:        'approved',
          reason:        dto.reason,
          createdBy:     ctx.userId,
        }));
      }

      // Record the refund payment
      await em.save(em.create(Payment, {
        transactionId: refundTxn.id,
        paymentMethod: dto.paymentMethod ?? 'cash',
        amount:        -refundTotal,
        status:        'refunded',
        notes:         dto.reason,
      }));

      // Mark original as refunded
      original.status = 'refunded';
      await em.save(original);

      return refundTxn;
    });
  }
}
