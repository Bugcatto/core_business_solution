import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  InventoryTransfer, InventoryMovement, Inventory,
} from '../database/entities/index';
import { TenantContext } from '../common/types/tenant-context.type';
import { z } from 'zod';

export const CreateTransferSchema = z.object({
  toBranchId: z.string().uuid(),
  notes:      z.string().optional(),
  lines: z.array(z.object({
    itemId:    z.string().uuid(),
    variantId: z.string().uuid().optional(),
    quantity:  z.number().positive(),
  })).min(1),
});
export type CreateTransferDto = z.infer<typeof CreateTransferSchema>;

@Injectable()
export class InventoryTransfersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(InventoryTransfer) private transferRepo: Repository<InventoryTransfer>,
    @InjectRepository(Inventory)         private invRepo:      Repository<Inventory>,
  ) {}

  findAll(ctx: TenantContext): Promise<InventoryTransfer[]> {
    return this.transferRepo.find({
      where: { businessId: ctx.businessId },
      order: { createdAt: 'DESC' },
    });
  }

  // Creates a transfer and immediately applies it (deduct from source, add to dest)
  // Both movement rows share the same transfer.id as transferPairId
  async create(ctx: TenantContext, dto: CreateTransferDto): Promise<InventoryTransfer> {
    return this.dataSource.transaction(async (em) => {
      const transfer = await em.save(em.create(InventoryTransfer, {
        businessId:   ctx.businessId,
        fromBranchId: ctx.branchId,
        toBranchId:   dto.toBranchId,
        status:       'completed',
        notes:        dto.notes ?? null,
        createdBy:    ctx.userId,
        completedAt:  new Date(),
      }));

      for (const line of dto.lines) {
        const vid = line.variantId ?? null;

        // ── Source branch: deduct stock ──────────────────────────────────────
        const srcInv = await em.findOne(Inventory, {
          where: { branchId: ctx.branchId, itemId: line.itemId, variantId: vid as any },
        });
        const srcBefore = srcInv ? Number(srcInv.quantity) : 0;
        const srcAfter  = srcBefore - line.quantity;

        if (srcAfter < 0) {
          throw new BadRequestException(
            `Insufficient stock for item ${line.itemId} in source branch`,
          );
        }

        if (srcInv) { srcInv.quantity = srcAfter; await em.save(srcInv); }

        await em.save(em.create(InventoryMovement, {
          businessId:    ctx.businessId,
          branchId:      ctx.branchId,
          itemId:        line.itemId,
          variantId:     vid,
          movementType:  'transfer_out',
          direction:     'out',
          quantity:      line.quantity,
          quantityBefore: srcBefore,
          quantityAfter:  srcAfter,
          referenceType: 'transfer',
          referenceId:   transfer.id,
          transferPairId: transfer.id,
          status:        'approved',
          createdBy:     ctx.userId,
        }));

        // ── Destination branch: add stock ────────────────────────────────────
        let dstInv = await em.findOne(Inventory, {
          where: { branchId: dto.toBranchId, itemId: line.itemId, variantId: vid as any },
        });
        const dstBefore = dstInv ? Number(dstInv.quantity) : 0;
        const dstAfter  = dstBefore + line.quantity;

        if (dstInv) {
          dstInv.quantity = dstAfter;
          await em.save(dstInv);
        } else {
          await em.save(em.create(Inventory, {
            branchId:         dto.toBranchId,
            itemId:           line.itemId,
            variantId:        vid,
            quantity:         dstAfter,
            reservedQuantity: 0,
            reorderLevel:     0,
          }));
        }

        await em.save(em.create(InventoryMovement, {
          businessId:    ctx.businessId,
          branchId:      dto.toBranchId,
          itemId:        line.itemId,
          variantId:     vid,
          movementType:  'transfer_in',
          direction:     'in',
          quantity:      line.quantity,
          quantityBefore: dstBefore,
          quantityAfter:  dstAfter,
          referenceType: 'transfer',
          referenceId:   transfer.id,
          transferPairId: transfer.id,
          status:        'approved',
          createdBy:     ctx.userId,
        }));
      }

      return transfer;
    });
  }
}
