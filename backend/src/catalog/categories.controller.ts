import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { FirebaseAuthGuard, PermissionsGuard, ModuleGuard } from '../common/guards/index';
import { CurrentUser, Permissions, RequireModule } from '../common/decorators/index';
import { TenantContext } from '../common/types/tenant-context.type';

@Controller('categories')
@UseGuards(FirebaseAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('catalog')

export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @Get()
  @Permissions('inventory.item.read', 'inventory.item.manage', 'pos.sale.create')
  findAll(@CurrentUser() ctx: TenantContext) {
    return this.service.findAll(ctx);
  }

  @Post()
  @Permissions('inventory.item.manage')
  create(
    @CurrentUser() ctx: TenantContext,
    @Body() dto: { name: string; description?: string; parentId?: string },
  ) {
    return this.service.create(ctx, dto);
  }

  @Patch(':id')
  @Permissions('inventory.item.manage')
  update(
    @CurrentUser() ctx: TenantContext,
    @Param('id') id: string,
    @Body() dto: { name?: string; description?: string },
  ) {
    return this.service.update(ctx, id, dto);
  }

  @Delete(':id')
  @Permissions('inventory.item.manage')
  deactivate(@CurrentUser() ctx: TenantContext, @Param('id') id: string) {
    return this.service.deactivate(ctx, id);
  }
}
