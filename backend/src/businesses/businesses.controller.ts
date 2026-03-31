import { Controller, Get, Patch, Body, UseGuards, UseInterceptors } from '@nestjs/common';
import { BusinessesService } from './businesses.service';
import { FirebaseAuthGuard, PermissionsGuard } from '../common/guards/index';
import { TenantContextInterceptor } from '../common/interceptors/index';
import { CurrentUser, Permissions } from '../common/decorators/index';
import { TenantContext } from '../common/types/tenant-context.type';
import { UpdateBusinessDto } from './dto/update-business.dto';

@Controller('businesses')
@UseGuards(FirebaseAuthGuard, PermissionsGuard)
@UseInterceptors(TenantContextInterceptor)
export class BusinessesController {
  constructor(private readonly service: BusinessesService) {}

  @Get('me')
  getMyBusiness(@CurrentUser() ctx: TenantContext) {
    return this.service.findById(ctx.businessId);
  }

  @Patch('me')
  @Permissions('settings.manage')
  update(
    @CurrentUser() ctx: TenantContext,
    @Body() dto: UpdateBusinessDto,
  ) {
    return this.service.update(ctx, dto);
  }
}
