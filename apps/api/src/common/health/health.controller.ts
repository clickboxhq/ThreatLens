import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { HealthService } from './health.service';

@Controller()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /**
   * Liveness: is this process still running and able to answer?
   *
   * Deliberately checks nothing else. Railway restarts a container that fails its healthcheck,
   * and restarting the API because Redis has a bad disk fixes nothing — it would have produced
   * a restart loop during the 2026-10-04 outage, turning a broken dependency into a broken
   * dependency plus an API that never stays up. Dependency state belongs on /ready.
   */
  @Get('health')
  getHealth() {
    return { status: 'ok' };
  }

  /**
   * Readiness: are the things this service depends on actually usable?
   *
   * This is the one to point a monitor at. It returns 503 with per-dependency detail when
   * something is wrong, so an alert can say which dependency and why rather than just "down".
   */
  @Get('ready')
  async getReady(@Res({ passthrough: true }) res: Response) {
    const report = await this.health.readiness();
    // 503 rather than 200-with-a-flag: a monitor should not have to parse a body to know, and
    // the previous endpoint's habit of always returning 200 is exactly what let a day-long
    // outage go unnoticed.
    res.status(report.ok ? 200 : 503);
    return report;
  }
}
