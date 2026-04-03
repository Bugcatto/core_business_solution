import {
  Controller, Get, Post, Put, Delete,
  Param, Body, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { RbacService } from './rbac.service';
import { FirebaseAuthGuard, PermissionsGuard } from '../common/guards/index';
import { CurrentUser, Permissions } from '../common/decorators/index';
import { TenantContext } from '../common/types/tenant-context.type';

@Controller('rbac')
@UseGuards(FirebaseAuthGuard, PermissionsGuard)

export class RbacController {
  constructor(private readonly service: RbacService) {}

  // user.invite is included so managers can load roles when inviting staff.
  // The Owner role is excluded from results — it must not be assignable via invite.
  @Get('roles')
  @Permissions('user.role.assign', 'user.invite')
  getRoles(@CurrentUser() ctx: TenantContext) {
    return this.service.getRolesForInvite(ctx);
  }

  @Post('roles')
  @Permissions('user.role.assign')
  createRole(
    @CurrentUser() ctx: TenantContext,
    @Body() body: { name: string; description?: string },
  ) {
    return this.service.createRole(ctx, body.name, body.description);
  }

  @Delete('roles/:id')
  @Permissions('user.role.assign')
  deleteRole(@CurrentUser() ctx: TenantContext, @Param('id') id: string) {
    return this.service.deleteRole(ctx, id);
  }

  @Get('permissions')
  @Permissions('user.role.assign')
  getAllPermissions() {
    return this.service.getAllPermissions();
  }

  @Get('roles/:id/permissions')
  @Permissions('user.role.assign')
  getRolePermissions(@CurrentUser() ctx: TenantContext, @Param('id') id: string) {
    return this.service.getRolePermissions(ctx, id);
  }

  @Put('roles/:id/permissions')
  @Permissions('user.role.assign')
  setRolePermissions(
    @CurrentUser() ctx: TenantContext,
    @Param('id') id: string,
    @Body() body: { permissions: string[] },
  ) {
    return this.service.setRolePermissions(ctx, id, body.permissions);
  }

  @Post('users/:userId/roles/:roleId')
  @Permissions('user.manage', 'user.role.assign')
  assignRole(
    @CurrentUser() ctx: TenantContext,
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
    @Body() body: { branchId?: string },
  ) {
    return this.service.assignRole(ctx, userId, roleId, body.branchId);
  }

  @Delete('users/:userId/roles/:roleId')
  @Permissions('user.manage', 'user.role.assign')
  revokeRole(
    @CurrentUser() ctx: TenantContext,
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
  ) {
    return this.service.revokeRole(ctx, userId, roleId);
  }
}
