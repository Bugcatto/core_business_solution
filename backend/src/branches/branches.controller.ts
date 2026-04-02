import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { BranchesService, CreateBranchDto } from './branches.service';
import { FirebaseAuthGuard, PermissionsGuard } from '../common/guards/index';
import { CurrentUser, Permissions } from '../common/decorators/index';
import { TenantContext } from '../common/types/tenant-context.type';

@Controller('branches')
@UseGuards(FirebaseAuthGuard, PermissionsGuard)

export class BranchesController {
  constructor(private readonly service: BranchesService) {}

  @Get()
  @Permissions('branches.view')
  findAll(@CurrentUser() ctx: TenantContext) {
    return this.service.findAll(ctx);
  }

  @Get(':id')
  @Permissions('branches.view')
  findOne(@CurrentUser() ctx: TenantContext, @Param('id') id: string) {
    return this.service.findOne(ctx, id);
  }

  @Post()
  @Permissions('branches.manage')
  create(@CurrentUser() ctx: TenantContext, @Body() dto: CreateBranchDto) {
    return this.service.create(ctx, dto);
  }

  @Patch(':id')
  @Permissions('branches.manage')
  update(
    @CurrentUser() ctx: TenantContext,
    @Param('id') id: string,
    @Body() dto: Partial<CreateBranchDto>,
  ) {
    return this.service.update(ctx, id, dto);
  }

  @Delete(':id')
  @Permissions('branches.manage')
  deactivate(@CurrentUser() ctx: TenantContext, @Param('id') id: string) {
    return this.service.deactivate(ctx, id);
  }
}
