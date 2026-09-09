import { applyDecorators, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

// Every admin controller carries the same gate: authenticated, and `platform_admin`
// specifically. Server-side and non-negotiable — hiding the nav is not the mechanism, this
// is. An org_admin or instructor calling any of these endpoints directly gets a 403.
export const PlatformAdminOnly = () =>
  applyDecorators(UseGuards(JwtAuthGuard, RolesGuard), Roles('platform_admin'));

import type { Request } from 'express';
export const actorIpOf = (req: Request): string | undefined =>
  req.ip ?? undefined;
