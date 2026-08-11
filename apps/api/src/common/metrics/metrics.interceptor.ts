import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';
import { MetricsService } from './metrics.service';

// Registered globally (metrics.module.ts) so every HTTP request is instrumented without
// touching individual controllers.
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const start = process.hrtime.bigint();

    const record = () => {
      // req.route.path is the matched Express pattern (e.g. "/sessions/:id"), not the literal
      // URL — using the literal path as a label would blow up cardinality with one series per
      // session/incident/etc ID ever requested.
      const route =
        (req.route?.path as string | undefined) ?? req.path ?? 'unknown';
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
      const labels = {
        method: req.method,
        route,
        status_code: String(res.statusCode),
      };
      this.metricsService.httpRequestDuration.observe(labels, durationSeconds);
      this.metricsService.httpRequestsTotal.inc(labels);
    };

    return next.handle().pipe(tap({ next: record, error: record }));
  }
}
