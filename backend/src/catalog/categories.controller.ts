import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { FirebaseAuthGuard, PermissionsGuard } from '../common/guards/index';
import { CurrentUser, Permissions } from '../common/decorators/index';
import { TenantContext } from '../common/types/tenant-context.type';

@Controller('categories')
@UseGuards(FirebaseAuthGuard, PermissionsGuard)

export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @Get()
  @Permissions('items.view')
  findAll(@CurrentUser() ctx: TenantContext) {
    return this.service.findAll(ctx);
  }

  @Post()
  @Permissions('items.manage')
  create(
    @CurrentUser() ctx: TenantContext,
    @Body() dto: { name: string; description?: string; parentId?: string },
  ) {
    return this.service.create(ctx, dto);
  }

  @Patch(':id')
  @Permissions('items.manage')
  update(
    @CurrentUser() ctx: TenantContext,
    @Param('id') id: string,
    @Body() dto: { name?: string; description?: string },
  ) {
    return this.service.update(ctx, id, dto);
  }

  @Delete(':id')
  @Permissions('items.manage')
  deactivate(@CurrentUser() ctx: TenantContext, @Param('id') id: string) {
    return this.service.deactivate(ctx, id);
  }
}
