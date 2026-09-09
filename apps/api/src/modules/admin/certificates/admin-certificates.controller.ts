import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { IsIn, IsOptional } from 'class-validator';
import { AdminCertificatesService } from './admin-certificates.service';
import { PaginationQuery } from '../dto/pagination.query';
import { RevokeCertificateDto } from '../dto/admin-mutations.dto';
import { PlatformAdminOnly, actorIpOf } from '../admin-guard.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/guards/jwt-auth.guard';

class ListCertificatesQuery extends PaginationQuery {
  @IsOptional()
  @IsIn(['active', 'revoked'])
  status?: 'active' | 'revoked';
}

@Controller('admin/certificates')
@PlatformAdminOnly()
export class AdminCertificatesController {
  constructor(private readonly certs: AdminCertificatesService) {}

  @Get()
  list(@Query() query: ListCertificatesQuery) {
    return this.certs.list(query);
  }

  @Get(':id')
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.certs.getDetail(id);
  }

  @Post(':id/revoke')
  revoke(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevokeCertificateDto,
    @Req() req: Request,
  ) {
    return this.certs.revoke(admin, id, dto.reason, actorIpOf(req));
  }

  @Post(':id/reissue')
  reissue(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.certs.reissue(admin, id, actorIpOf(req));
  }
}
