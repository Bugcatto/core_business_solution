import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryMovement } from '../database/entities/index';
import { TenantContext } from '../common/types/tenant-context.type';
import { z } from 'zod';

export const MovementQuerySchema = z.object({
  itemId:        z.string().uuid().optional(),
  movementType:  z.string().optional(),
  direction:     z.enum(['in', 'out']).optional(),
  startDate:     z.string().optional(),
  endDate:       z.string().optional(),
  page:          z.coerce.number().int().min(1).default(1),
  limit:         z.coerce.number().int().min(1).max(100).default(50),
});
export type MovementQueryDto = z.infer<typeof MovementQuerySchema>;

@Injectable()
export class InventoryMovementsService {
  constructor(
    @InjectRepository(InventoryMovement)
    private readonly repo: Repository<InventoryMovement>,
  ) {}

  async findAll(ctx: TenantContext, query: MovementQueryDto) {
    const qb = this.repo
      .createQueryBuilder('mv')
      .where('mv.businessId = :bid',  { bid: ctx.businessId })
      .andWhere('mv.branchId = :brid',{ brid: ctx.branchId })
      .andWhere('mv.status = :status',{ status: 'approved' });

    if (query.itemId)       qb.andWhere('mv.itemId = :iid',      { iid: query.itemId });
    if (query.movementType) qb.andWhere('mv.movementType = :mt', { mt: query.movementType });
    if (query.direction)    qb.andWhere('mv.direction = :dir',   { dir: query.direction });

    if (query.startDate) {
      qb.andWhere('mv.createdAt >= :start', { start: new Date(query.startDate) });
    }
    if (query.endDate) {
      qb.andWhere('mv.createdAt <= :end', {
        end: new Date(new Date(query.endDate).setHours(23, 59, 59, 999)),
      });
    }

    const [items, total] = await qb
      .orderBy('mv.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();

    return { items, total, page: query.page, totalPages: Math.ceil(total / query.limit) };
  }

  // Full movement history for a single item — used for the item audit page
  async getItemHistory(ctx: TenantContext, itemId: string) {
    return this.repo.find({
      where: { businessId: ctx.businessId, itemId, status: 'approved' },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }
}
