import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { PlatformSettingsService } from '../../modules/admin/platform-settings/platform-settings.service';

// When a platform admin turns on maintenance mode (Platform Settings), non-admin API traffic
// is turned away with 503. The allowlist keeps the ways back in open: health/ready/metrics
// probes, the auth endpoints (so an admin can still sign in), and everything under /admin
// (still RolesGuard-gated, so a non-admin reaching it gets 403, not access). The setting is
// served from PlatformSettingsService's short in-process cache, so this is not a DB hit per
// request.
//
// Matched against the full request path with any leading `/api/v1` prefix stripped, so it
// works whether or not the global prefix has been applied at the point this middleware runs.
const ALLOW = [
  /^\/health$/,
  /^\/ready$/,
  /^\/metrics$/,
  /^\/auth(\/|$)/,
  /^\/admin(\/|$)/,
];

@Injectable()
export class MaintenanceMiddleware implements NestMiddleware {
  constructor(private readonly settings: PlatformSettingsService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const path = (req.originalUrl || req.url)
      .split('?')[0]
      .replace(/^\/api\/v1/, '');
    if (ALLOW.some((re) => re.test(path))) {
      return next();
    }
    const { maintenanceMode } = await this.settings.get();
    if (!maintenanceMode) return next();

    res.status(503).json({
      error: {
        code: 'MAINTENANCE_MODE',
        message:
          'ThreatLens is temporarily unavailable for maintenance. Please try again shortly.',
      },
    });
  }
}
