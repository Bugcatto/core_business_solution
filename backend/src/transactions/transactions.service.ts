import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, FindManyOptions, IsNull } from 'typeorm';
import { Transaction, TransactionLine, Payment, InventoryMovement, Inventory } from '../database/entities/index';
import { TenantContext } from '../common/types/tenant-context.type';
import { TransactionQueryDto, VoidTransactionDto } from './dto/index';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Transaction)     private txnRepo: Repository<Transaction>,
    @InjectRepository(TransactionLine) private lineRepo: Repository<TransactionLine>,
    @InjectRepository(Payment)         private paymentRepo: Repository<Payment>,
  ) {}

  async findAll(ctx: TenantContext, query: TransactionQueryDto) {
    const where: any = {
      businessId: ctx.businessId,
      branchId:   ctx.branchId,
    };

    if (query.status)        where.status        = query.status;
    if (query.posTerminalId) where.posTerminalId = query.posTerminalId;
    if (query.contactId)     where.contactId     = query.contactId;

    if (query.startDate && query.endDate) {
      where.createdAt = Between(
        new Date(query.startDate),
        new Date(new Date(query.endDate).setHours(23, 59, 59, 999)),
      );
    }

    const [items, total] = await this.txnRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip:  (query.page - 1) * query.limit,
      take:  query.limit,
    });

    return {
      items,
      total,
      page:       query.page,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async findOne(ctx: TenantContext, id: string) {
    const txn = await this.txnRepo.findOne({
      where: { id, businessId: ctx.businessId },
    });
    if (!txn) throw new NotFoundException('Transaction not found');

    const lines    = await this.lineRepo.find({ where: { transactionId: id } });
    const payments = await this.paymentRepo.find({ where: { transactionId: id } });

    return { ...txn, lines, payments };
  }

  async void(ctx: TenantContext, id: string, dto: VoidTransactionDto): Promise<Transaction> {
    return this.dataSource.transaction(async (em) => {
      const txn = await em.findOne(Transaction, {
        where: { id, businessId: ctx.businessId },
      });
      if (!txn) throw new NotFoundException('Transaction not found');
      if (txn.status !== 'completed') {
        throw new BadRequestException(`Cannot void a transaction with status: ${txn.status}`);
      }

      // Reverse all inventory movements from this transaction
      const movements = await em.find(InventoryMovement, {
        where: { referenceType: 'transaction', referenceId: id },
      });

      for (const mv of movements) {
        // Reverse: a 'sale' (out) becomes a 'return_in' (in)
        await em.save(em.create(InventoryMovement, {
          businessId:    ctx.businessId,
          branchId:      mv.branchId,
          itemId:        mv.itemId,
          variantId:     mv.variantId,
          movementType:  'return_in',
          direction:     'in',
          quantity:      mv.quantity,
          quantityBefore: mv.quantityAfter,
          quantityAfter:  mv.quantityAfter + mv.quantity,
          referenceType: 'transaction',
          referenceId:   id,
          status:        'approved',
          reason:        `void: ${dto.reason}`,
          createdBy:     ctx.userId,
        }));

        // Restore the inventory snapshot
        const inv = await em.findOne(Inventory, {
          where: { branchId: mv.branchId, itemId: mv.itemId, variantId: mv.variantId ?? IsNull() },
        });
        if (inv) {
          inv.quantity = Number(inv.quantity) + Number(mv.quantity);
          await em.save(inv);
        }
      }

      txn.status = 'voided';
      txn.notes  = txn.notes ? `${txn.notes} | Void: ${dto.reason}` : `Void: ${dto.reason}`;
      return em.save(txn);
    });
  }

  // Summary figures for the dashboard / shift report
  async getDailySummary(ctx: TenantContext, date: string) {
    const start = new Date(date);
    const end   = new Date(new Date(date).setHours(23, 59, 59, 999));

    const result = await this.txnRepo
      .createQueryBuilder('t')
      .select('COUNT(t.id)',                         'transactionCount')
      .addSelect('SUM(t.totalAmount)',               'grossSales')
      .addSelect('SUM(t.discountAmount)',             'totalDiscounts')
      .addSelect('SUM(t.taxAmount)',                  'totalTax')
      .where('t.businessId = :bid',    { bid: ctx.businessId })
      .andWhere('t.branchId = :brid',  { brid: ctx.branchId })
      .andWhere('t.status = :status',  { status: 'completed' })
      .andWhere('t.createdAt BETWEEN :start AND :end', { start, end })
      .getRawOne();

    return {
      date,
      transactionCount: Number(result.transactionCount ?? 0),
      grossSales:       Number(result.grossSales    ?? 0),
      totalDiscounts:   Number(result.totalDiscounts ?? 0),
      totalTax:         Number(result.totalTax       ?? 0),
      netSales:         Number(result.grossSales ?? 0) - Number(result.totalDiscounts ?? 0),
    };
  }
}
