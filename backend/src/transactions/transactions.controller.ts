import {
  Controller, Get, Post, Patch, Param,
  Body, Query, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { TransactionsService } from './transactions.service';
import { PaymentsService } from './payments.service';
import { ReceiptService } from './receipt.service';
import { FirebaseAuthGuard, PermissionsGuard, ModuleGuard } from '../common/guards/index';
import { CurrentUser, Permissions, RequireModule } from '../common/decorators/index';
import { TenantContext } from '../common/types/tenant-context.type';
import {
  CheckoutDto, TransactionQueryDto,
  VoidTransactionDto, RefundDto,
} from './dto/index';

@Controller('transactions')
@UseGuards(FirebaseAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('pos')

export class TransactionsController {
  constructor(
    private readonly checkoutService:     CheckoutService,
    private readonly transactionsService: TransactionsService,
    private readonly paymentsService:     PaymentsService,
    private readonly receiptService:      ReceiptService,
  ) {}

  // ── Checkout ────────────────────────────────────────────────────────────────
  @Post('checkout')
  @Permissions('pos.sale.create')
  checkout(@CurrentUser() ctx: TenantContext, @Body() dto: CheckoutDto) {
    return this.checkoutService.checkout(ctx, dto);
  }

  // ── History ─────────────────────────────────────────────────────────────────
  @Get()
  @Permissions('pos.sale.create')
  findAll(@CurrentUser() ctx: TenantContext, @Query() query: TransactionQueryDto) {
    return this.transactionsService.findAll(ctx, query);
  }

  @Get('summary')
  @Permissions('reports.sales.read')
  getDailySummary(
    @CurrentUser() ctx: TenantContext,
    @Query('date') date: string,
  ) {
    return this.transactionsService.getDailySummary(
      ctx,
      date ?? new Date().toISOString().slice(0, 10),
    );
  }

  @Get(':id')
  @Permissions('pos.sale.create')
  findOne(@CurrentUser() ctx: TenantContext, @Param('id') id: string) {
    return this.transactionsService.findOne(ctx, id);
  }

  // ── Receipt ─────────────────────────────────────────────────────────────────
  @Get(':id/receipt')
  @Permissions('pos.sale.create')
  getReceipt(@CurrentUser() ctx: TenantContext, @Param('id') id: string) {
    return this.receiptService.getReceiptData(ctx, id);
  }

  @Get(':id/receipt/thermal')
  @Permissions('pos.sale.create')
  getThermalReceipt(@CurrentUser() ctx: TenantContext, @Param('id') id: string) {
    return this.receiptService.getThermalText(ctx, id);
  }

  // ── Void ────────────────────────────────────────────────────────────────────
  @Patch(':id/void')
  @Permissions('pos.sale.void')
  void(
    @CurrentUser() ctx: TenantContext,
    @Param('id') id: string,
    @Body() dto: VoidTransactionDto,
  ) {
    return this.transactionsService.void(ctx, id, dto);
  }

  // ── Refund ──────────────────────────────────────────────────────────────────
  @Post(':id/refund')
  @Permissions('pos.sale.refund')
  refund(
    @CurrentUser() ctx: TenantContext,
    @Param('id') id: string,
    @Body() dto: RefundDto,
  ) {
    return this.paymentsService.refund(ctx, id, dto);
  }
}
