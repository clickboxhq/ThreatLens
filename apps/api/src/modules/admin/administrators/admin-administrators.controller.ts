import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { IsEmail } from 'class-validator';
import { AdminAdministratorsService } from './admin-administrators.service';
import { PlatformAdminOnly, actorIpOf } from '../admin-guard.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/guards/jwt-auth.guard';

class GrantAdminDto {
  @IsEmail()
  email!: string;
}

@Controller('admin/administrators')
@PlatformAdminOnly()
export class AdminAdministratorsController {
  constructor(private readonly admins: AdminAdministratorsService) {}

  @Get()
  list() {
    return this.admins.list();
  }

  @Post()
  grant(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: GrantAdminDto,
    @Req() req: Request,
  ) {
    return this.admins.grant(admin, dto.email, actorIpOf(req));
  }

  @Delete(':userId')
  revoke(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Req() req: Request,
  ) {
    return this.admins.revoke(admin, userId, actorIpOf(req));
  }
}
