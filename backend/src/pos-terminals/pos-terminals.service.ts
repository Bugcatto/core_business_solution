import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PosTerminal, Branch } from '../database/entities/index';
import { TenantContext } from '../common/types/tenant-context.type';
import { CreatePosTerminalDto } from './dto/pos-terminal.dto';

@Injectable()
export class PosTerminalsService {
  constructor(
    @InjectRepository(PosTerminal) private terminalRepo: Repository<PosTerminal>,
    @InjectRepository(Branch)      private branchRepo: Repository<Branch>,
  ) {}

  async create(dto: CreatePosTerminalDto, ctx: TenantContext): Promise<PosTerminal> {
    // Ensure the branch belongs to this business
    const branch = await this.branchRepo.findOne({
      where: { id: dto.branchId, businessId: ctx.businessId },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    const terminal = this.terminalRepo.create({
      businessId: ctx.businessId,
      branchId:   dto.branchId,
      name:       dto.name,
    });
    return this.terminalRepo.save(terminal);
  }

  async findAll(branchId: string, ctx: TenantContext): Promise<PosTerminal[]> {
    // Verify branch belongs to this business
    const branch = await this.branchRepo.findOne({
      where: { id: branchId, businessId: ctx.businessId },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    return this.terminalRepo.find({
      where: { businessId: ctx.businessId, branchId, isActive: true },
      order: { createdAt: 'ASC' },
    });
  }

  async findOne(id: string, ctx: TenantContext): Promise<PosTerminal> {
    const terminal = await this.terminalRepo.findOne({
      where: { id, businessId: ctx.businessId },
    });

    if (!terminal) throw new NotFoundException('POS terminal not found');
    return terminal;
  }

  async deactivate(id: string, ctx: TenantContext): Promise<void> {
    const terminal = await this.findOne(id, ctx);
    terminal.isActive = false;
    await this.terminalRepo.save(terminal);
  }
}
