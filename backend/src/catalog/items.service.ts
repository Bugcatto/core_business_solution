import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindManyOptions } from 'typeorm';
import { Item } from '../database/entities/index';
import { TenantContext } from '../common/types/tenant-context.type';
import { CreateItemDto, UpdateItemDto, ItemQueryDto } from './dto/index';

@Injectable()
export class ItemsService {
  constructor(
    @InjectRepository(Item)
    private readonly repo: Repository<Item>,
  ) {}

  async findAll(ctx: TenantContext, query: ItemQueryDto): Promise<Item[]> {
    const where: FindManyOptions<Item>['where'] = {
      businessId: ctx.businessId,
      isActive: true,
    };

    if (query.categoryId) (where as any).categoryId = query.categoryId;
    if (query.itemType)   (where as any).itemType   = query.itemType;
    if (query.search) {
      return this.repo.find({
        where: [
          { businessId: ctx.businessId, isActive: true, name: Like(`%${query.search}%`) },
          { businessId: ctx.businessId, isActive: true, sku: Like(`%${query.search}%`) },
          { businessId: ctx.businessId, isActive: true, barcode: query.search },
        ],
        order: { name: 'ASC' },
      });
    }

    return this.repo.find({ where, order: { name: 'ASC' } });
  }

  async findOne(ctx: TenantContext, id: string): Promise<Item> {
    const item = await this.repo.findOne({
      where: { id, businessId: ctx.businessId },
    });
    if (!item) throw new NotFoundException('Item not found');
    return item;
  }

  async findByBarcode(ctx: TenantContext, barcode: string): Promise<Item> {
    const item = await this.repo.findOne({
      where: { barcode, businessId: ctx.businessId, isActive: true },
    });
    if (!item) throw new NotFoundException(`No item found for barcode: ${barcode}`);
    return item;
  }

  async create(ctx: TenantContext, dto: CreateItemDto): Promise<Item> {
    if (dto.sku) {
      const existing = await this.repo.findOne({
        where: { sku: dto.sku, businessId: ctx.businessId },
      });
      if (existing) throw new ConflictException(`SKU '${dto.sku}' already exists`);
    }

    const item = this.repo.create({ ...dto, businessId: ctx.businessId });
    return this.repo.save(item);
  }

  async update(ctx: TenantContext, id: string, dto: UpdateItemDto): Promise<Item> {
    const item = await this.findOne(ctx, id);
    Object.assign(item, dto);
    return this.repo.save(item);
  }

  async deactivate(ctx: TenantContext, id: string): Promise<void> {
    const item = await this.findOne(ctx, id);
    item.isActive = false;
    await this.repo.save(item);
  }

  // Called by CheckoutService to resolve item price at time of sale
  async resolvePrice(ctx: TenantContext, itemId: string, variantId?: string): Promise<number> {
    const item = await this.findOne(ctx, itemId);
    if (variantId) {
      const { ItemVariantsService } = await import('./item-variants.service');
      // Price override is resolved in CheckoutService directly
    }
    return Number(item.price);
  }
}
