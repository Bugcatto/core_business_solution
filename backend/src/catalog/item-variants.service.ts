import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ItemVariant } from '../database/entities/index';

@Injectable()
export class ItemVariantsService {
  constructor(
    @InjectRepository(ItemVariant)
    private readonly repo: Repository<ItemVariant>,
  ) {}

  findForItem(itemId: string): Promise<ItemVariant[]> {
    return this.repo.find({
      where: { itemId, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string, itemId: string): Promise<ItemVariant> {
    const v = await this.repo.findOne({ where: { id, itemId } });
    if (!v) throw new NotFoundException('Variant not found');
    return v;
  }

  async create(
    itemId: string,
    dto: { name: string; sku?: string; barcode?: string; priceOverride?: number },
  ): Promise<ItemVariant> {
    const variant = this.repo.create({ ...dto, itemId });
    return this.repo.save(variant);
  }

  async update(
    id: string,
    itemId: string,
    dto: Partial<{ name: string; sku: string; barcode: string; priceOverride: number }>,
  ): Promise<ItemVariant> {
    const v = await this.findOne(id, itemId);
    Object.assign(v, dto);
    return this.repo.save(v);
  }

  // Resolves the effective price — variant override takes precedence over item base price
  async resolvePrice(variantId: string, itemId: string, basePrice: number): Promise<number> {
    const v = await this.findOne(variantId, itemId);
    return v.priceOverride != null ? Number(v.priceOverride) : basePrice;
  }
}
