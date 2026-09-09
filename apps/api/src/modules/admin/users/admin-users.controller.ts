import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminUsersService } from './admin-users.service';
import { ListUsersQuery } from './list-users.query';
import { SetUserStatusDto } from '../dto/admin-mutations.dto';
import { PlatformAdminOnly, actorIpOf } from '../admin-guard.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/guards/jwt-auth.guard';

@Controller('admin/users')
@PlatformAdminOnly()
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list(@Query() query: ListUsersQuery) {
    return this.users.list(query);
  }

  @Get(':id')
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.getDetail(id);
  }

  @Patch(':id/status')
  setStatus(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserStatusDto,
    @Req() req: Request,
  ) {
    return this.users.setStatus(admin, id, dto.status, actorIpOf(req));
  }

  @Post(':id/reset-mfa')
  resetMfa(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.users.resetMfa(admin, id, actorIpOf(req));
  }
}
