import {
  Controller, Get, Post, Patch, Param,
  Body, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { FirebaseAuthGuard } from '../common/guards/index';
import { TenantContextInterceptor } from '../common/interceptors/index';
import { CurrentUser, FirebaseUid, Public } from '../common/decorators/index';
import { TenantContext } from '../common/types/tenant-context.type';
import { CreateBusinessDto, SelectTypeDto, SelectPlanDto } from '../businesses/dto/index';

@Controller('onboarding')
@UseGuards(FirebaseAuthGuard)
export class OnboardingController {
  constructor(private readonly service: OnboardingService) {}

  // ── Status (resumable — call on every app load) ────────────────────────────
  @Get('status')
  @UseInterceptors(TenantContextInterceptor)
  getStatus(@CurrentUser() ctx: TenantContext) {
    return this.service.getStatus(ctx.businessId);
  }

  // ── Step 2: Create business ────────────────────────────────────────────────
  // No TenantContext here — business doesn't exist yet
  @Post('business')
  createBusiness(
    @FirebaseUid() uid: string,
    @Body() dto: CreateBusinessDto,
  ) {
    return this.service.createBusiness(uid, dto);
  }

  // ── Step 3: Select type ────────────────────────────────────────────────────
  @Post('type')
  @UseInterceptors(TenantContextInterceptor)
  selectType(
    @CurrentUser() ctx: TenantContext,
    @Body() dto: SelectTypeDto,
  ) {
    return this.service.selectType(ctx.businessId, dto.businessType);
  }

  // ── Step 4+5: Select plan → auto-provision ─────────────────────────────────
  @Post('plan')
  @UseInterceptors(TenantContextInterceptor)
  async selectPlan(
    @CurrentUser() ctx: TenantContext,
    @Body() dto: SelectPlanDto,
  ) {
    await this.service.selectPlan(ctx.businessId, dto.plan);
    return this.service.provision(ctx.businessId);
  }

  // ── Step 6: Wizard checklist ───────────────────────────────────────────────
  @Patch('wizard/:step')
  @UseInterceptors(TenantContextInterceptor)
  markWizardStep(
    @CurrentUser() ctx: TenantContext,
    @Param('step') step: string,
  ) {
    return this.service.markWizardStep(ctx.businessId, step as any);
  }

  // ── Save partial form state ────────────────────────────────────────────────
  @Post('draft')
  @UseInterceptors(TenantContextInterceptor)
  saveDraft(
    @CurrentUser() ctx: TenantContext,
    @Body() body: Record<string, any>,
  ) {
    return this.service.saveDraft(ctx.businessId, body);
  }
}
