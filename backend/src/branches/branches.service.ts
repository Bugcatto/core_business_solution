// ─── branches.service.ts ─────────────────────────────────────────────────────
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch, UserBranch } from '../database/entities/index';
import { TenantContext } from '../common/types/tenant-context.type';
import { z } from 'zod';

export const CreateBranchSchema = z.object({
  name:     z.string().min(1).max(100),
  address:  z.string().optional(),
  timezone: z.string().default('UTC'),
  phone:    z.string().optional(),
});
export type CreateBranchDto = z.infer<typeof CreateBranchSchema>;

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch)     private branchRepo: Repository<Branch>,
    @InjectRepository(UserBranch) private userBranchRepo: Repository<UserBranch>,
  ) {}

  findAll(ctx: TenantContext): Promise<Branch[]> {
    return this.branchRepo.find({
      where: { businessId: ctx.businessId, isActive: true },
      order: { createdAt: 'ASC' },
    });
  }

  async findOne(ctx: TenantContext, id: string): Promise<Branch> {
    const branch = await this.branchRepo.findOne({
      where: { id, businessId: ctx.businessId },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async create(ctx: TenantContext, dto: CreateBranchDto): Promise<Branch> {
    const branch = this.branchRepo.create({ ...dto, businessId: ctx.businessId });
    return this.branchRepo.save(branch);
  }

  async update(ctx: TenantContext, id: string, dto: Partial<CreateBranchDto>): Promise<Branch> {
    const branch = await this.findOne(ctx, id);
    Object.assign(branch, dto);
    return this.branchRepo.save(branch);
  }

  async deactivate(ctx: TenantContext, id: string): Promise<void> {
    const branch = await this.findOne(ctx, id);
    branch.isActive = false;
    await this.branchRepo.save(branch);
  }
}
