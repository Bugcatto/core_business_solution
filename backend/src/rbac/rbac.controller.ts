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

  // users.invite is included so Managers can load roles when inviting staff.
  // The Owner role is excluded from results — it must not be assignable via invite.
  @Get('roles')
  @Permissions('roles.manage', 'users.invite')
  getRoles(@CurrentUser() ctx: TenantContext) {
    return this.service.getRolesForInvite(ctx);
  }

  @Post('roles')
  @Permissions('roles.manage')
  createRole(
    @CurrentUser() ctx: TenantContext,
    @Body() body: { name: string; description?: string },
  ) {
    return this.service.createRole(ctx, body.name, body.description);
  }

  @Delete('roles/:id')
  @Permissions('roles.manage')
  deleteRole(@CurrentUser() ctx: TenantContext, @Param('id') id: string) {
    return this.service.deleteRole(ctx, id);
  }

  @Get('permissions')
  @Permissions('roles.manage')
  getAllPermissions() {
    return this.service.getAllPermissions();
  }

  @Get('roles/:id/permissions')
  @Permissions('roles.manage')
  getRolePermissions(@CurrentUser() ctx: TenantContext, @Param('id') id: string) {
    return this.service.getRolePermissions(ctx, id);
  }

  @Put('roles/:id/permissions')
  @Permissions('roles.manage')
  setRolePermissions(
    @CurrentUser() ctx: TenantContext,
    @Param('id') id: string,
    @Body() body: { permissions: string[] },
  ) {
    return this.service.setRolePermissions(ctx, id, body.permissions);
  }

  @Post('users/:userId/roles/:roleId')
  @Permissions('users.manage')
  assignRole(
    @CurrentUser() ctx: TenantContext,
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
    @Body() body: { branchId?: string },
  ) {
    return this.service.assignRole(ctx, userId, roleId, body.branchId);
  }

  @Delete('users/:userId/roles/:roleId')
  @Permissions('users.manage')
  revokeRole(
    @CurrentUser() ctx: TenantContext,
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
  ) {
    return this.service.revokeRole(ctx, userId, roleId);
  }
}
