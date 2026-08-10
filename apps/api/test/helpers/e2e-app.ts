import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { ScrubbingLogger } from '../../src/common/logging/scrubbing-logger.service';

// Boots the real AppModule — every module, every BullMQ processor, against whatever
// DATABASE_URL/REDIS_URL is in the environment (a real Postgres + Redis, not mocks). This is
// deliberately the same configuration main.ts's bootstrap() applies, minus attachRealtimeGateway
// (WebSocket is out of scope for this REST-driven e2e pass and already covered by earlier
// manual live verification).
export async function createE2EApp(): Promise<INestApplication> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication({
    logger: new ScrubbingLogger(),
  });

  app.setGlobalPrefix('api/v1', { exclude: ['health', 'ready', 'metrics'] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();
  return app;
}

// §12.3: the same forbidden-substring check dto.spec.ts runs against hand-built DTOs, applied
// here to real HTTP response bodies — a stronger guarantee, since it exercises the actual
// NestJS serialization path rather than a unit-constructed object.
const FORBIDDEN_SUBSTRINGS = [
  'isGroundTruthEvidence',
  'isGroundTruthActor',
  'isFalsePositiveByDesign',
  'correlationId',
];

export function assertNoForbiddenFields(body: unknown): void {
  const json = JSON.stringify(body);
  for (const forbidden of FORBIDDEN_SUBSTRINGS) {
    expect(json).not.toContain(forbidden);
  }
}

// Background jobs (telemetry generation, alert correlation, scoring) run for real against
// real BullMQ/Redis in this suite — there's nothing to trigger manually, only something to
// wait for, the same way this project's live Docker verification has polled `ready`/score
// throughout development.
export async function pollUntil<T>(
  fn: () => Promise<T>,
  predicate: (value: T) => boolean,
  timeoutMs: number,
  intervalMs = 1000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: T;
  for (;;) {
    last = await fn();
    if (predicate(last)) return last;
    if (Date.now() >= deadline) {
      throw new Error(
        `pollUntil: timed out after ${timeoutMs}ms waiting for condition. Last value: ${JSON.stringify(last)}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
