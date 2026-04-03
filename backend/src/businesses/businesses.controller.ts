import { Controller, Get, Patch, Body, UseGuards, UseInterceptors } from '@nestjs/common';
import { BusinessesService } from './businesses.service';
import { FirebaseAuthGuard, PermissionsGuard } from '../common/guards/index';
import { CurrentUser, Permissions } from '../common/decorators/index';
import { TenantContext } from '../common/types/tenant-context.type';
import { UpdateBusinessDto } from './dto/index';

@Controller('businesses')
@UseGuards(FirebaseAuthGuard, PermissionsGuard)

export class BusinessesController {
  constructor(private readonly service: BusinessesService) {}

  @Get('me')
  getMyBusiness(@CurrentUser() ctx: TenantContext) {
    return this.service.findById(ctx.businessId);
  }

  @Patch('me')
  @Permissions('settings.general.manage')
  update(
    @CurrentUser() ctx: TenantContext,
    @Body() dto: UpdateBusinessDto,
  ) {
    return this.service.update(ctx, dto);
  }
}
