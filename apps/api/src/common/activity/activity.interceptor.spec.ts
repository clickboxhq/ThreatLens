import { ExecutionContext, CallHandler } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { of, throwError } from 'rxjs';
import { ActivityInterceptor } from './activity.interceptor';
import { TRACKS_ACTIVITY_KEY } from '../decorators/tracks-activity.decorator';

function buildInterceptor(opts: { tracks: boolean }) {
  const reflector = {
    getAllAndOverride: jest.fn((key: string) =>
      key === TRACKS_ACTIVITY_KEY ? opts.tracks : undefined,
    ),
  };
  const activityTracking = { touch: jest.fn(async () => undefined) };
  const interceptor = new ActivityInterceptor(
    reflector as never,
    activityTracking as never,
  );
  return { interceptor, reflector, activityTracking };
}

function contextWithUser(userId: string | undefined) {
  const request = { user: userId ? { id: userId } : undefined };
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function handlerReturning(value: unknown): CallHandler {
  return { handle: () => of(value) };
}

function handlerThrowing(err: unknown): CallHandler {
  return { handle: () => throwError(() => err) };
}

describe('ActivityInterceptor', () => {
  it('does nothing on a route not marked @TracksActivity()', (done) => {
    const { interceptor, activityTracking } = buildInterceptor({
      tracks: false,
    });
    const userId = randomUUID();

    interceptor
      .intercept(contextWithUser(userId), handlerReturning({ ok: true }))
      .subscribe(() => {
        expect(activityTracking.touch).not.toHaveBeenCalled();
        done();
      });
  });

  it('does nothing when there is no authenticated user on the request', (done) => {
    const { interceptor, activityTracking } = buildInterceptor({
      tracks: true,
    });

    interceptor
      .intercept(contextWithUser(undefined), handlerReturning({ ok: true }))
      .subscribe(() => {
        expect(activityTracking.touch).not.toHaveBeenCalled();
        done();
      });
  });

  it('touches activity for the caller on a successful response to a @TracksActivity() route', (done) => {
    const { interceptor, activityTracking } = buildInterceptor({
      tracks: true,
    });
    const userId = randomUUID();

    interceptor
      .intercept(contextWithUser(userId), handlerReturning({ ok: true }))
      .subscribe(() => {
        // Fire-and-forget: give the microtask queue a tick before asserting.
        setImmediate(() => {
          expect(activityTracking.touch).toHaveBeenCalledWith(userId);
          done();
        });
      });
  });

  it('does not record activity when the underlying request fails', (done) => {
    const { interceptor, activityTracking } = buildInterceptor({
      tracks: true,
    });
    const userId = randomUUID();

    interceptor
      .intercept(contextWithUser(userId), handlerThrowing(new Error('nope')))
      .subscribe({
        error: () => {
          setImmediate(() => {
            expect(activityTracking.touch).not.toHaveBeenCalled();
            done();
          });
        },
      });
  });
});
