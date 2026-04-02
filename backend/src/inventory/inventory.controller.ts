import {
  Controller, Get, Post, Patch, Param,
  Body, Query, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryAdjustmentsService, CreateAdjustmentDto } from './inventory-adjustments.service';
import { InventoryTransfersService, CreateTransferDto } from './inventory-transfers.service';
import { InventoryMovementsService, MovementQueryDto } from './inventory-movements.service';
import { FirebaseAuthGuard, PermissionsGuard } from '../common/guards/index';
import { CurrentUser, Permissions } from '../common/decorators/index';
import { TenantContext } from '../common/types/tenant-context.type';

@Controller('inventory')
@UseGuards(FirebaseAuthGuard, PermissionsGuard)

export class InventoryController {
  constructor(
    private readonly inventoryService:   InventoryService,
    private readonly adjustmentsService: InventoryAdjustmentsService,
    private readonly transfersService:   InventoryTransfersService,
    private readonly movementsService:   InventoryMovementsService,
  ) {}

  // ── Stock levels ────────────────────────────────────────────────────────────
  @Get()
  @Permissions('inventory.view')
  getStockLevels(
    @CurrentUser() ctx: TenantContext,
    @Query('branchId') branchId?: string,
  ) {
    return this.inventoryService.getStockLevels(ctx, branchId);
  }

  @Get('low-stock')
  @Permissions('inventory.view')
  getLowStock(@CurrentUser() ctx: TenantContext) {
    return this.inventoryService.getLowStockItems(ctx);
  }

  @Patch('opening-stock')
  @Permissions('inventory.adjust')
  setOpeningStock(
    @CurrentUser() ctx: TenantContext,
    @Body() body: {
      itemId: string;
      variantId?: string;
      quantity: number;
      reorderLevel?: number;
    },
  ) {
    return this.inventoryService.setOpeningStock(
      ctx, body.itemId, body.variantId ?? null, body.quantity, body.reorderLevel,
    );
  }

  @Patch(':itemId/reorder-level')
  @Permissions('inventory.adjust')
  updateReorderLevel(
    @CurrentUser() ctx: TenantContext,
    @Param('itemId') itemId: string,
    @Body() body: { reorderLevel: number },
  ) {
    return this.inventoryService.updateReorderLevel(ctx, itemId, body.reorderLevel);
  }

  // ── Movements audit trail ───────────────────────────────────────────────────
  @Get('movements')
  @Permissions('inventory.view')
  getMovements(@CurrentUser() ctx: TenantContext, @Query() query: MovementQueryDto) {
    return this.movementsService.findAll(ctx, query);
  }

  @Get('movements/item/:itemId')
  @Permissions('inventory.view')
  getItemHistory(@CurrentUser() ctx: TenantContext, @Param('itemId') itemId: string) {
    return this.movementsService.getItemHistory(ctx, itemId);
  }

  // ── Adjustments ─────────────────────────────────────────────────────────────
  @Get('adjustments')
  @Permissions('inventory.view')
  getAdjustments(
    @CurrentUser() ctx: TenantContext,
    @Query('status') status?: string,
  ) {
    return this.adjustmentsService.findAll(ctx, status);
  }

  @Post('adjustments')
  @Permissions('inventory.adjust')
  createAdjustment(@CurrentUser() ctx: TenantContext, @Body() dto: CreateAdjustmentDto) {
    return this.adjustmentsService.create(ctx, dto);
  }

  @Patch('adjustments/:id/approve')
  @Permissions('inventory.approve')
  approveAdjustment(@CurrentUser() ctx: TenantContext, @Param('id') id: string) {
    return this.adjustmentsService.approve(ctx, id);
  }

  @Patch('adjustments/:id/reject')
  @Permissions('inventory.approve')
  rejectAdjustment(
    @CurrentUser() ctx: TenantContext,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.adjustmentsService.reject(ctx, id, body.reason);
  }

  // ── Transfers ───────────────────────────────────────────────────────────────
  @Get('transfers')
  @Permissions('inventory.view')
  getTransfers(@CurrentUser() ctx: TenantContext) {
    return this.transfersService.findAll(ctx);
  }

  @Post('transfers')
  @Permissions('inventory.transfer')
  createTransfer(@CurrentUser() ctx: TenantContext, @Body() dto: CreateTransferDto) {
    return this.transfersService.create(ctx, dto);
  }
}
