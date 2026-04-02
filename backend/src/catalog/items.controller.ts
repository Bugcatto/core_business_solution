import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { ItemsService } from './items.service';
import { ItemVariantsService } from './item-variants.service';
import { FirebaseAuthGuard, PermissionsGuard } from '../common/guards/index';
import { CurrentUser, Permissions } from '../common/decorators/index';
import { TenantContext } from '../common/types/tenant-context.type';
import { CreateItemDto, UpdateItemDto, ItemQueryDto, CreateVariantDto } from './dto/index';

@Controller('items')
@UseGuards(FirebaseAuthGuard, PermissionsGuard)

export class ItemsController {
  constructor(
    private readonly itemsService: ItemsService,
    private readonly variantsService: ItemVariantsService,
  ) {}

  @Get()
  @Permissions('items.view', 'items.manage', 'pos.create')
  findAll(@CurrentUser() ctx: TenantContext, @Query() query: ItemQueryDto) {
    return this.itemsService.findAll(ctx, query);
  }

  @Get('barcode/:barcode')
  @Permissions('items.view', 'items.manage', 'pos.create')
  findByBarcode(@CurrentUser() ctx: TenantContext, @Param('barcode') barcode: string) {
    return this.itemsService.findByBarcode(ctx, barcode);
  }

  @Get(':id')
  @Permissions('items.view', 'items.manage', 'pos.create')
  findOne(@CurrentUser() ctx: TenantContext, @Param('id') id: string) {
    return this.itemsService.findOne(ctx, id);
  }

  @Post()
  @Permissions('items.manage')
  create(@CurrentUser() ctx: TenantContext, @Body() dto: CreateItemDto) {
    return this.itemsService.create(ctx, dto);
  }

  @Patch(':id')
  @Permissions('items.manage')
  update(
    @CurrentUser() ctx: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.itemsService.update(ctx, id, dto);
  }

  @Delete(':id')
  @Permissions('items.manage')
  deactivate(@CurrentUser() ctx: TenantContext, @Param('id') id: string) {
    return this.itemsService.deactivate(ctx, id);
  }

  // ── Variants ────────────────────────────────────────────────────────────────
  @Get(':id/variants')
  @Permissions('items.view', 'items.manage', 'pos.create')
  getVariants(@Param('id') itemId: string) {
    return this.variantsService.findForItem(itemId);
  }

  @Post(':id/variants')
  @Permissions('items.manage')
  createVariant(@Param('id') itemId: string, @Body() dto: CreateVariantDto) {
    return this.variantsService.create(itemId, dto);
  }

  @Patch(':id/variants/:variantId')
  @Permissions('items.manage')
  updateVariant(
    @Param('id') itemId: string,
    @Param('variantId') variantId: string,
    @Body() dto: Partial<CreateVariantDto>,
  ) {
    return this.variantsService.update(variantId, itemId, dto);
  }
}
