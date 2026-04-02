import {
  Controller, Get, Post, Delete,
  Param, Body, Query, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { PosTerminalsService } from './pos-terminals.service';
import { CreatePosTerminalDto, CreatePosTerminalSchema } from './dto/pos-terminal.dto';
import { FirebaseAuthGuard, PermissionsGuard } from '../common/guards/index';
import { CurrentUser, Permissions } from '../common/decorators/index';
import { TenantContext } from '../common/types/tenant-context.type';
import { BadRequestException } from '@nestjs/common';

@Controller('pos-terminals')
@UseGuards(FirebaseAuthGuard, PermissionsGuard)

export class PosTerminalsController {
  constructor(private readonly service: PosTerminalsService) {}

  @Post()
  @Permissions('branches.manage')
  create(@CurrentUser() ctx: TenantContext, @Body() body: CreatePosTerminalDto) {
    const result = CreatePosTerminalSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return this.service.create(result.data, ctx);
  }

  @Get()
  @Permissions('branches.view')
  findAll(@CurrentUser() ctx: TenantContext, @Query('branchId') branchId: string) {
    if (!branchId) throw new BadRequestException('branchId query param is required');
    return this.service.findAll(branchId, ctx);
  }

  @Get(':id')
  @Permissions('branches.view')
  findOne(@CurrentUser() ctx: TenantContext, @Param('id') id: string) {
    return this.service.findOne(id, ctx);
  }

  @Delete(':id')
  @Permissions('branches.manage')
  deactivate(@CurrentUser() ctx: TenantContext, @Param('id') id: string) {
    return this.service.deactivate(id, ctx);
  }
}
