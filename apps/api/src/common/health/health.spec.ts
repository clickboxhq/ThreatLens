const redisCalls = {
  set: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  quit: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
};

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => redisCalls),
}));

import { HealthService } from './health.service';
import { HealthController } from './health.controller';
import { HealthWatcherService } from './health-watcher.service';
import type { PrismaService } from '../../prisma/prisma.service';

// The reply that took authentication down. Redis was up, connected, and serving reads.
const MISCONF = new Error(
  "MISCONF Redis is configured to save RDB snapshots, but it's currently unable to persist to disk.",
);

const config = { get: () => 'redis://localhost:6379' } as never;

function healthyPrisma(): PrismaService {
  return {
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  } as never;
}

// Every HealthService holds a Redis client and implements OnModuleDestroy. Building them
// without tearing them down passes when this file runs alone and leaves a Jest worker alive
// alongside everything else — the same leak that turns a spec into a CI job that never ends.
const built: HealthService[] = [];

function build(prisma: PrismaService = healthyPrisma()) {
  const svc = new HealthService(prisma, config);
  jest
    .spyOn(
      (svc as unknown as { logger: { error: () => void } }).logger,
      'error',
    )
    .mockImplementation(() => undefined);
  built.push(svc);
  return svc;
}

describe('HealthService readiness', () => {
  beforeEach(() => {
    for (const fn of Object.values(redisCalls)) fn.mockReset();
    redisCalls.quit.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    while (built.length) await built.pop()!.onModuleDestroy();
    jest.restoreAllMocks();
  });

  it('reports healthy when both dependencies answer', async () => {
    redisCalls.set.mockResolvedValue('OK');
    redisCalls.get.mockImplementation(async () => lastWrittenValue());
    redisCalls.del.mockResolvedValue(1);

    const report = await build().readiness();
    expect(report.ok).toBe(true);
    expect(report.dependencies.postgres.ok).toBe(true);
    expect(report.dependencies.redis.ok).toBe(true);
  });

  // The whole reason this file exists. During the outage Redis answered PING and every read,
  // and refused only writes — so any probe short of a write would have reported green.
  it('catches a Redis that reads fine but refuses writes', async () => {
    redisCalls.set.mockRejectedValue(MISCONF);
    redisCalls.get.mockResolvedValue('anything');

    const report = await build().readiness();
    expect(report.ok).toBe(false);
    expect(report.dependencies.redis.ok).toBe(false);
    expect(report.dependencies.redis.detail).toContain('MISCONF');
  });

  it('catches a Redis that accepts a write and loses it', async () => {
    redisCalls.set.mockResolvedValue('OK');
    redisCalls.get.mockResolvedValue(null); // accepted, then gone
    const report = await build().readiness();
    expect(report.ok).toBe(false);
    expect(report.dependencies.redis.detail).toContain('not retaining writes');
  });

  it('catches Postgres being unreachable', async () => {
    redisCalls.set.mockResolvedValue('OK');
    redisCalls.get.mockImplementation(async () => lastWrittenValue());
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('connection refused')),
    } as never;

    const report = await build(prisma).readiness();
    expect(report.ok).toBe(false);
    expect(report.dependencies.postgres.ok).toBe(false);
  });

  it('reports one dependency failing without hiding the other', async () => {
    // Both are probed in parallel; a broken Redis must not mask a broken Postgres.
    redisCalls.set.mockRejectedValue(MISCONF);
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('connection refused')),
    } as never;

    const report = await build(prisma).readiness();
    expect(report.dependencies.redis.ok).toBe(false);
    expect(report.dependencies.postgres.ok).toBe(false);
  });

  function lastWrittenValue(): string {
    const call = redisCalls.set.mock.calls.at(-1);
    return call ? String(call[1]) : '';
  }
});

describe('HealthWatcherService alerting', () => {
  const unhealthy = {
    ok: false,
    checkedAt: new Date().toISOString(),
    dependencies: { redis: { ok: false, detail: 'MISCONF', ms: 3 } },
  };
  const healthy = {
    ok: true,
    checkedAt: new Date().toISOString(),
    dependencies: { redis: { ok: true, ms: 2 } },
  };

  // null, not undefined: passing undefined to a parameter with a default silently gets the
  // default back, which made this helper claim an address was configured when the test meant
  // the opposite.
  function watcher(
    readiness: jest.Mock,
    alertEmail: string | null = 'ops@example.com',
  ) {
    const send = jest.fn().mockResolvedValue(undefined);
    const w = new HealthWatcherService(
      { readiness } as never,
      { send } as never,
      {
        get: (k: string) =>
          k === 'OPS_ALERT_EMAIL' ? (alertEmail ?? undefined) : undefined,
      } as never,
    );
    const logger = (
      w as unknown as { logger: { error: () => void; log: () => void } }
    ).logger;
    jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    jest.spyOn(logger, 'log').mockImplementation(() => undefined);
    return { w, send };
  }

  it('does not alert on a single failure', async () => {
    // One failed probe is as likely to be a dropped packet as an outage, and an alert channel
    // that cries wolf gets muted.
    const { w, send } = watcher(jest.fn().mockResolvedValue(unhealthy));
    await w.tick();
    expect(send).not.toHaveBeenCalled();
  });

  it('alerts once two consecutive probes fail', async () => {
    const { w, send } = watcher(jest.fn().mockResolvedValue(unhealthy));
    await w.tick();
    await w.tick();
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'ops@example.com' }),
    );
    expect(send.mock.calls[0][0].html).toContain('MISCONF');
  });

  it('does not repeat the alert every minute', async () => {
    const { w, send } = watcher(jest.fn().mockResolvedValue(unhealthy));
    for (let i = 0; i < 6; i++) await w.tick();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('says so when it recovers, and can alert again afterwards', async () => {
    const readiness = jest.fn();
    const { w, send } = watcher(readiness);

    readiness.mockResolvedValue(unhealthy);
    await w.tick();
    await w.tick(); // alert 1

    readiness.mockResolvedValue(healthy);
    await w.tick(); // recovery

    readiness.mockResolvedValue(unhealthy);
    await w.tick();
    await w.tick(); // alert 2

    const subjects = send.mock.calls.map((c) => c[0].subject);
    expect(subjects).toEqual([
      'ThreatLens: a dependency is down',
      'ThreatLens: dependencies recovered',
      'ThreatLens: a dependency is down',
    ]);
  });

  it('does not pretend to have alerted when no address is configured', async () => {
    const { w, send } = watcher(jest.fn().mockResolvedValue(unhealthy), null);
    await w.tick();
    await w.tick();
    expect(send).not.toHaveBeenCalled();
  });

  it('survives the probe itself throwing', async () => {
    const { w, send } = watcher(jest.fn().mockRejectedValue(new Error('boom')));
    await expect(w.tick()).resolves.toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });
});

describe('HealthController', () => {
  function res() {
    return { status: jest.fn().mockReturnThis() } as never;
  }

  it('returns 200 and the report when everything is up', async () => {
    const report = { ok: true, checkedAt: 'now', dependencies: {} };
    const c = new HealthController({ readiness: async () => report } as never);
    const r = res();
    // passthrough means the handler sets the status and Nest still serialises the return
    // value. Worth asserting both, since getting it wrong yields a 200 with an empty body —
    // which a monitor would read as healthy.
    await expect(c.getReady(r)).resolves.toBe(report);
    expect((r as unknown as { status: jest.Mock }).status).toHaveBeenCalledWith(
      200,
    );
  });

  it('returns 503 when a dependency is down', async () => {
    const report = {
      ok: false,
      checkedAt: 'now',
      dependencies: { redis: { ok: false, detail: 'MISCONF', ms: 1 } },
    };
    const c = new HealthController({ readiness: async () => report } as never);
    const r = res();
    await expect(c.getReady(r)).resolves.toBe(report);
    expect((r as unknown as { status: jest.Mock }).status).toHaveBeenCalledWith(
      503,
    );
  });

  it('keeps /health as a liveness check that does not touch dependencies', () => {
    // If this ever starts probing, Railway will restart the container whenever a dependency
    // is sick — a restart loop on top of an outage.
    const readiness = jest.fn();
    const c = new HealthController({ readiness } as never);
    expect(c.getHealth()).toEqual({ status: 'ok' });
    expect(readiness).not.toHaveBeenCalled();
  });
});
