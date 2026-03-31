import {
  Controller, Get, Post, Delete, Param, Body,
  UseGuards, UseInterceptors,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { FirebaseAuthGuard, PermissionsGuard } from '../common/guards/index';
import { TenantContextInterceptor } from '../common/interceptors/index';
import { CurrentUser, Permissions, Public } from '../common/decorators/index';
import { TenantContext } from '../common/types/tenant-context.type';
import { InviteUserDto } from './dto/index';

@Controller('users')
@UseGuards(FirebaseAuthGuard, PermissionsGuard)
@UseInterceptors(TenantContextInterceptor)
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  @Permissions('users.manage')
  findAll(@CurrentUser() ctx: TenantContext) {
    return this.service.findAllForBusiness(ctx.businessId);
  }

  @Post('invite')
  @Permissions('users.invite')
  invite(@CurrentUser() ctx: TenantContext, @Body() dto: InviteUserDto) {
    return this.service.invite(ctx, dto);
  }

  @Post('accept-invite/:token')
  @Public()
  acceptInvite(@Param('token') token: string) {
    return this.service.acceptInvite(token);
  }

  @Delete(':id')
  @Permissions('users.manage')
  deactivate(@CurrentUser() ctx: TenantContext, @Param('id') id: string) {
    return this.service.deactivate(ctx, id);
  }
}
