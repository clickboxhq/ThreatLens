import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request } from 'express';
import { ActivityTrackingService } from './activity-tracking.service';
import { TRACKS_ACTIVITY_KEY } from '../decorators/tracks-activity.decorator';
import type { AuthenticatedUser } from '../guards/jwt-auth.guard';

// Registered globally (activity.module.ts), same pattern as MetricsInterceptor — but unlike
// metrics, this only acts on routes explicitly opted in via @TracksActivity(), so every other
// route (reads, notifications, auth, polling) is untouched. Fires only after a successful
// response: a validation error, a 403, or any other failure never counts as "did something".
@Injectable()
export class ActivityInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly activityTracking: ActivityTrackingService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const tracks = this.reflector.getAllAndOverride<boolean>(
      TRACKS_ACTIVITY_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!tracks) return next.handle();

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const userId = request.user?.id;
    if (!userId) return next.handle();

    return next.handle().pipe(
      tap({
        next: () => {
          // Fire-and-forget: must never slow down or fail the real request.
          void this.activityTracking.touch(userId);
        },
      }),
    );
  }
}
