import { Controller, Get, Header } from '@nestjs/common';
import { MetricsService } from './metrics.service';

// No auth guard here, same posture as /health — this is reachable only by Prometheus over the
// internal Docker network (infra/docker-compose.prod.yml), never proxied through the public
// nginx edge (infra/nginx/templates/default.conf.template has no /metrics location block).
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  getMetrics(): Promise<string> {
    return this.metricsService.metrics();
  }
}
