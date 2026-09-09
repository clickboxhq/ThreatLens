import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AdminSettingsService } from './admin-settings.service';
import { UpdatePlatformSettingsDto } from '../dto/admin-mutations.dto';
import { PlatformAdminOnly, actorIpOf } from '../admin-guard.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/guards/jwt-auth.guard';

@Controller('admin/settings')
@PlatformAdminOnly()
export class AdminSettingsController {
  constructor(private readonly settings: AdminSettingsService) {}

  @Get()
  get() {
    return this.settings.get();
  }

  @Patch()
  update(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: UpdatePlatformSettingsDto,
    @Req() req: Request,
  ) {
    return this.settings.update(admin, dto, actorIpOf(req));
  }
}
