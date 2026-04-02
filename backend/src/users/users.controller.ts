import {
  Controller, Get, Post, Delete, Param, Body,
  UseGuards, NotFoundException, Request,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { BusinessesService } from '../businesses/businesses.service';
import { PosTerminal } from '../database/entities/index';
import { FirebaseAuthGuard, PermissionsGuard } from '../common/guards/index';
import { CurrentUser, Permissions, Public } from '../common/decorators/index';
import { TenantContext } from '../common/types/tenant-context.type';
import { AuthenticatedRequest } from '../common/types/tenant-context.type';
import { InviteUserDto, AcceptInviteDto } from './dto/index';

@Controller('users')
@UseGuards(FirebaseAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(
    private readonly service: UsersService,
    private readonly businessesService: BusinessesService,
    @InjectRepository(PosTerminal) private terminalRepo: Repository<PosTerminal>,
  ) {}

  @Get('me')
  async getMe(@CurrentUser() ctx: TenantContext) {
    if (!ctx?.businessId) {
      throw new NotFoundException('User has no business context');
    }

    const [business, terminal] = await Promise.all([
      this.businessesService.findById(ctx.businessId),
      this.terminalRepo.findOne({
        where: { businessId: ctx.businessId, branchId: ctx.branchId, isActive: true },
        order: { createdAt: 'ASC' },
      }),
    ]);
    return {
      businessId:        ctx.businessId,
      branchId:          ctx.branchId,
      businessName:      business.name,
      businessType:      business.businessType,
      plan:              business.subscriptionPlan,
      defaultTerminalId: terminal?.id ?? null,
      permissions:       ctx.permissions ?? [],
      isOwner:           ctx.isOwner ?? false,
    };
  }

  @Get()
  @Permissions('users.manage', 'users.invite')
  findAll(@CurrentUser() ctx: TenantContext) {
    return this.service.findAllForBusiness(ctx.businessId);
  }

  @Post('invite')
  @Permissions('users.invite')
  invite(@CurrentUser() ctx: TenantContext, @Body() dto: InviteUserDto) {
    return this.service.invite(ctx, dto);
  }

  // ── Accept invite: new user sets their password ───────────────────────────
  @Post('accept-invite/:token')
  @Public()
  acceptInvite(@Param('token') token: string, @Body() dto: AcceptInviteDto) {
    return this.service.acceptInvite(token, dto);
  }

  // ── Invite preview: returns business+branch info for the pending invite ───
  @Get('accept-invite/:token/preview')
  @Public()
  getInvitePreview(@Param('token') token: string) {
    return this.service.getInvitePreview(token);
  }

  // ── Link invite: existing user — get confirmation info ────────────────────
  @Get('accept-invite/:token/link')
  linkInvitePreview(
    @Param('token') token: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.service.linkInvite(token, req.firebaseUid);
  }

  // ── Link invite: existing user — confirm and complete ────────────────────
  @Post('accept-invite/:token/link')
  confirmLinkInvite(
    @Param('token') token: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.service.confirmLinkInvite(token, req.firebaseUid);
  }

  // ── Reactivate deactivated staff ──────────────────────────────────────────
  @Post(':id/reactivate')
  @Permissions('users.manage')
  reactivate(@CurrentUser() ctx: TenantContext, @Param('id') id: string) {
    return this.service.reactivate(ctx, id);
  }

  @Delete(':id')
  @Permissions('users.manage')
  deactivate(@CurrentUser() ctx: TenantContext, @Param('id') id: string) {
    return this.service.deactivate(ctx, id);
  }
}
