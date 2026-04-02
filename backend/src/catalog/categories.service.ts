// ─── categories.service.ts ────────────────────────────────────────────────────
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../database/entities/index';
import { TenantContext } from '../common/types/tenant-context.type';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly repo: Repository<Category>,
  ) {}

  findAll(ctx: TenantContext): Promise<Category[]> {
    return this.repo.find({
      where: { businessId: ctx.businessId, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(ctx: TenantContext, id: string): Promise<Category> {
    const cat = await this.repo.findOne({
      where: { id, businessId: ctx.businessId },
    });
    if (!cat) throw new NotFoundException('Category not found');
    return cat;
  }

  async create(
    ctx: TenantContext,
    dto: { name: string; description?: string; parentId?: string },
  ): Promise<Category> {
    const cat = this.repo.create({ ...dto, businessId: ctx.businessId });
    return this.repo.save(cat);
  }

  async update(
    ctx: TenantContext,
    id: string,
    dto: { name?: string; description?: string },
  ): Promise<Category> {
    const cat = await this.findOne(ctx, id);
    Object.assign(cat, dto);
    return this.repo.save(cat);
  }

  async deactivate(ctx: TenantContext, id: string): Promise<void> {
    const cat = await this.findOne(ctx, id);
    cat.isActive = false;
    await this.repo.save(cat);
  }
}
