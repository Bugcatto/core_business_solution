import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { PlatformService } from './platform.service';
import { FirebaseAuthGuard } from '../common/guards/index';
import { AuthenticatedRequest } from '../common/types/tenant-context.type';

@Controller('platform')
@UseGuards(FirebaseAuthGuard)
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  // Returns platform owner profile + all owned businesses.
  // Used by the frontend on login to determine routing and populate the owner store.
  @Get('me')
  getMe(@Request() req: AuthenticatedRequest) {
    return this.platformService.getProfile(req.firebaseUid);
  }
}
