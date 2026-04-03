import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  InventoryAdjustment, InventoryMovement, Inventory,
} from '../database/entities/index';
import { TenantContext } from '../common/types/tenant-context.type';
import { z } from 'zod';

// ── DTOs ──────────────────────────────────────────────────────────────────────
export const CreateAdjustmentSchema = z.object({
  reasonCode: z.enum(['stock_count', 'damage', 'expiry', 'theft', 'return_to_supplier', 'other']),
  notes:      z.string().optional(),
  lines: z.array(z.object({
    itemId:    z.string().uuid(),
    variantId: z.string().uuid().optional(),
    direction: z.enum(['in', 'out']),
    quantity:  z.number().positive(),
  })).min(1),
});
export type CreateAdjustmentDto = z.infer<typeof CreateAdjustmentSchema>;

@Injectable()
export class InventoryAdjustmentsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(InventoryAdjustment) private adjRepo: Repository<InventoryAdjustment>,
    @InjectRepository(Inventory)           private invRepo:  Repository<Inventory>,
  ) {}

  findAll(ctx: TenantContext, status?: string): Promise<InventoryAdjustment[]> {
    const where: any = { businessId: ctx.businessId, branchId: ctx.branchId };
    if (status) where.status = status;
    return this.adjRepo.find({ where, order: { requestedAt: 'DESC' } });
  }

  async findOne(ctx: TenantContext, id: string): Promise<InventoryAdjustment> {
    const adj = await this.adjRepo.findOne({
      where: { id, businessId: ctx.businessId },
    });
    if (!adj) throw new NotFoundException('Adjustment not found');
    return adj;
  }

  // Creates the adjustment record + pending movement stubs — does NOT yet change stock
  async create(ctx: TenantContext, dto: CreateAdjustmentDto): Promise<InventoryAdjustment> {
    return this.dataSource.transaction(async (em) => {
      const adj = await em.save(em.create(InventoryAdjustment, {
        businessId:  ctx.businessId,
        branchId:    ctx.branchId,
        reasonCode:  dto.reasonCode,
        notes:       dto.notes ?? null,
        status:      'pending',
        requestedBy: ctx.userId,
      }));

      // Create movement stubs in 'pending' status — stock not yet changed
      for (const line of dto.lines) {
        const inv = await em.findOne(Inventory, {
          where: { branchId: ctx.branchId, itemId: line.itemId, variantId: line.variantId ?? null as any },
        });
        const qBefore = inv ? Number(inv.quantity) : 0;
        const qAfter  = line.direction === 'in'
          ? qBefore + line.quantity
          : qBefore - line.quantity;

        await em.save(em.create(InventoryMovement, {
          businessId:    ctx.businessId,
          branchId:      ctx.branchId,
          itemId:        line.itemId,
          variantId:     line.variantId ?? null,
          movementType:  line.direction === 'in' ? 'adjustment_in' : 'adjustment_out',
          direction:     line.direction,
          quantity:      line.quantity,
          quantityBefore: qBefore,
          quantityAfter:  qAfter,
          referenceType: 'adjustment',
          referenceId:   adj.id,
          status:        'pending',      // ← not applied yet
          reason:        dto.reasonCode,
          notes:         dto.notes ?? null,
          createdBy:     ctx.userId,
        }));
      }

      return adj;
    });
  }

  // Manager/Owner approves — applies all pending movements to inventory snapshot
  async approve(ctx: TenantContext, id: string): Promise<InventoryAdjustment> {
    if (!ctx.isOwner && !ctx.permissions.includes('inventory.stock.approve')) {
      throw new ForbiddenException('You do not have permission to approve adjustments');
    }

    return this.dataSource.transaction(async (em) => {
      const adj = await em.findOne(InventoryAdjustment, {
        where: { id, businessId: ctx.businessId },
      });
      if (!adj) throw new NotFoundException('Adjustment not found');
      if (adj.status !== 'pending') {
        throw new BadRequestException(`Adjustment is already ${adj.status}`);
      }

      // Find all pending movements for this adjustment
      const movements = await em.find(InventoryMovement, {
        where: { referenceType: 'adjustment', referenceId: id, status: 'pending' },
      });

      for (const mv of movements) {
        // Apply the quantity change to the inventory snapshot
        let inv = await em.findOne(Inventory, {
          where: { branchId: mv.branchId, itemId: mv.itemId, variantId: mv.variantId ?? null as any },
        });

        if (inv) {
          inv.quantity = mv.quantityAfter;
          await em.save(inv);
        } else {
          inv = em.create(Inventory, {
            branchId:         mv.branchId,
            itemId:           mv.itemId,
            variantId:        mv.variantId ?? null,
            quantity:         mv.quantityAfter,
            reservedQuantity: 0,
            reorderLevel:     0,
          });
          await em.save(inv);
        }

        // Stamp movement as approved
        mv.status     = 'approved';
        mv.approvedBy = ctx.userId;
        mv.approvedAt = new Date();
        await em.save(mv);
      }

      adj.status     = 'approved';
      adj.approvedBy = ctx.userId;
      adj.approvedAt = new Date();
      return em.save(adj);
    });
  }

  // Manager rejects — marks movements as rejected, no stock change
  async reject(ctx: TenantContext, id: string, reason: string): Promise<InventoryAdjustment> {
    return this.dataSource.transaction(async (em) => {
      const adj = await em.findOne(InventoryAdjustment, {
        where: { id, businessId: ctx.businessId },
      });
      if (!adj) throw new NotFoundException('Adjustment not found');
      if (adj.status !== 'pending') {
        throw new BadRequestException(`Adjustment is already ${adj.status}`);
      }

      await em.update(InventoryMovement,
        { referenceType: 'adjustment', referenceId: id },
        { status: 'rejected' },
      );

      adj.status = 'rejected';
      adj.notes  = adj.notes ? `${adj.notes} | Rejected: ${reason}` : `Rejected: ${reason}`;
      return em.save(adj);
    });
  }
}
