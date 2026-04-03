import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { ItemsService } from './items.service';
import { ItemVariantsService } from './item-variants.service';
import { FirebaseAuthGuard, PermissionsGuard, ModuleGuard } from '../common/guards/index';
import { CurrentUser, Permissions, RequireModule } from '../common/decorators/index';
import { TenantContext } from '../common/types/tenant-context.type';
import { CreateItemDto, UpdateItemDto, ItemQueryDto, CreateVariantDto } from './dto/index';

@Controller('items')
@UseGuards(FirebaseAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('catalog')

export class ItemsController {
  constructor(
    private readonly itemsService: ItemsService,
    private readonly variantsService: ItemVariantsService,
  ) {}

  @Get()
  @Permissions('inventory.item.read', 'inventory.item.manage', 'pos.sale.create')
  findAll(@CurrentUser() ctx: TenantContext, @Query() query: ItemQueryDto) {
    return this.itemsService.findAll(ctx, query);
  }

  @Get('barcode/:barcode')
  @Permissions('inventory.item.read', 'inventory.item.manage', 'pos.sale.create')
  findByBarcode(@CurrentUser() ctx: TenantContext, @Param('barcode') barcode: string) {
    return this.itemsService.findByBarcode(ctx, barcode);
  }

  @Get(':id')
  @Permissions('inventory.item.read', 'inventory.item.manage', 'pos.sale.create')
  findOne(@CurrentUser() ctx: TenantContext, @Param('id') id: string) {
    return this.itemsService.findOne(ctx, id);
  }

  @Post()
  @Permissions('inventory.item.manage')
  create(@CurrentUser() ctx: TenantContext, @Body() dto: CreateItemDto) {
    return this.itemsService.create(ctx, dto);
  }

  @Patch(':id')
  @Permissions('inventory.item.manage')
  update(
    @CurrentUser() ctx: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.itemsService.update(ctx, id, dto);
  }

  @Delete(':id')
  @Permissions('inventory.item.manage')
  deactivate(@CurrentUser() ctx: TenantContext, @Param('id') id: string) {
    return this.itemsService.deactivate(ctx, id);
  }

  // ── Variants ────────────────────────────────────────────────────────────────
  @Get(':id/variants')
  @Permissions('inventory.item.read', 'inventory.item.manage', 'pos.sale.create')
  getVariants(@Param('id') itemId: string) {
    return this.variantsService.findForItem(itemId);
  }

  @Post(':id/variants')
  @Permissions('inventory.item.manage')
  createVariant(@Param('id') itemId: string, @Body() dto: CreateVariantDto) {
    return this.variantsService.create(itemId, dto);
  }

  @Patch(':id/variants/:variantId')
  @Permissions('inventory.item.manage')
  updateVariant(
    @Param('id') itemId: string,
    @Param('variantId') variantId: string,
    @Body() dto: Partial<CreateVariantDto>,
  ) {
    return this.variantsService.update(variantId, itemId, dto);
  }
}
