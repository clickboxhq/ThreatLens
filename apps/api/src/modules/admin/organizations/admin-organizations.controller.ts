import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { IsIn, IsOptional } from 'class-validator';
import { AdminOrganizationsService } from './admin-organizations.service';
import { PaginationQuery } from '../dto/pagination.query';
import { SetOrgStatusDto } from '../dto/admin-mutations.dto';
import { PlatformAdminOnly, actorIpOf } from '../admin-guard.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/guards/jwt-auth.guard';

class ListOrgsQuery extends PaginationQuery {
  @IsOptional()
  @IsIn(['active', 'suspended'])
  status?: 'active' | 'suspended';
}

@Controller('admin/organizations')
@PlatformAdminOnly()
export class AdminOrganizationsController {
  constructor(private readonly orgs: AdminOrganizationsService) {}

  @Get()
  list(@Query() query: ListOrgsQuery) {
    return this.orgs.list(query);
  }

  @Get(':id')
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.orgs.getDetail(id);
  }

  @Patch(':id/status')
  setStatus(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetOrgStatusDto,
    @Req() req: Request,
  ) {
    return this.orgs.setStatus(admin, id, dto.status, actorIpOf(req));
  }
}
