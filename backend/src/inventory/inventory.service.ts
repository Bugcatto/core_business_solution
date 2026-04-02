import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Inventory, InventoryMovement, Item } from '../database/entities/index';
import { TenantContext } from '../common/types/tenant-context.type';

export interface StockLevel {
  itemId:        string;
  variantId:     string | null;
  itemName:      string;
  sku:           string | null;
  quantity:      number;
  reservedQty:   number;
  availableQty:  number;
  reorderLevel:  number;
  isLow:         boolean;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Inventory) private invRepo: Repository<Inventory>,
    @InjectRepository(Item)      private itemRepo: Repository<Item>,
  ) {}

  async getStockLevels(ctx: TenantContext, branchId?: string): Promise<StockLevel[]> {
    const targetBranch = branchId ?? ctx.branchId;

    const rows = await this.invRepo
      .createQueryBuilder('inv')
      .innerJoin(Item, 'item', 'item.id = inv.itemId')
      .select([
        'inv.itemId         AS "itemId"',
        'inv.variantId      AS "variantId"',
        'item.name          AS "itemName"',
        'item.sku           AS sku',
        'inv.quantity       AS quantity',
        'inv.reservedQuantity AS "reservedQty"',
        'inv.reorderLevel   AS "reorderLevel"',
      ])
      .where('inv.branchId = :branchId', { branchId: targetBranch })
      .andWhere('item.businessId = :businessId', { businessId: ctx.businessId })
      .getRawMany();

    return rows.map((r) => ({
      itemId:       r.itemId,
      variantId:    r.variantId ?? null,
      itemName:     r.itemName,
      sku:          r.sku ?? null,
      quantity:     Number(r.quantity),
      reservedQty:  Number(r.reservedQty),
      availableQty: Number(r.quantity) - Number(r.reservedQty),
      reorderLevel: Number(r.reorderLevel),
      isLow:        Number(r.quantity) <= Number(r.reorderLevel),
    }));
  }

  async getLowStockItems(ctx: TenantContext): Promise<StockLevel[]> {
    const all = await this.getStockLevels(ctx);
    return all.filter((s) => s.isLow);
  }

  // Sets opening stock for an item — creates the first movement record
  async setOpeningStock(
    ctx: TenantContext,
    itemId: string,
    variantId: string | null,
    quantity: number,
    reorderLevel?: number,
  ): Promise<Inventory> {
    return this.dataSource.transaction(async (em) => {
      let inv = await em.findOne(Inventory, {
        where: { branchId: ctx.branchId, itemId, variantId: variantId ?? null as any },
      });

      const qBefore = inv ? Number(inv.quantity) : 0;

      if (inv) {
        inv.quantity     = quantity;
        if (reorderLevel != null) inv.reorderLevel = reorderLevel;
      } else {
        inv = em.create(Inventory, {
          branchId:         ctx.branchId,
          itemId,
          variantId:        variantId ?? null,
          quantity,
          reservedQuantity: 0,
          reorderLevel:     reorderLevel ?? 0,
        });
      }
      await em.save(inv);

      await em.save(em.create(InventoryMovement, {
        businessId:    ctx.businessId,
        branchId:      ctx.branchId,
        itemId,
        variantId:     variantId ?? null,
        movementType:  'opening_stock',
        direction:     quantity >= qBefore ? 'in' : 'out',
        quantity:      Math.abs(quantity - qBefore),
        quantityBefore: qBefore,
        quantityAfter:  quantity,
        status:        'approved',
        reason:        'Opening stock',
        createdBy:     ctx.userId,
      }));

      return inv;
    });
  }

  async updateReorderLevel(
    ctx: TenantContext,
    itemId: string,
    reorderLevel: number,
  ): Promise<void> {
    await this.invRepo.update(
      { branchId: ctx.branchId, itemId },
      { reorderLevel },
    );
  }
}
