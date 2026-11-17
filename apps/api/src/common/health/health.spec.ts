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

describe('HealthWatcherService worker probe', () => {
  // The worker's own /ready, over Railway's private network. Nothing polled it before: the
  // 2026-11-14 outage was a worker crash-looping on a stale DATABASE_URL for two days, found
  // by a person looking at the dashboard.
  const WORKER_URL = 'http://worker.railway.internal:3000/ready';

  const healthy = {
    ok: true,
    checkedAt: new Date().toISOString(),
    dependencies: { redis: { ok: true, ms: 2 } },
  };
  const localUnhealthy = {
    ok: false,
    checkedAt: new Date().toISOString(),
    dependencies: { redis: { ok: false, detail: 'MISCONF', ms: 3 } },
  };

  const realFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as never;
  });

  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  // null rather than undefined for "unset", for the same reason as the helper above: passing
  // undefined to a defaulted parameter silently gets the default back.
  function watcher(
    workerReadyUrl: string | null = WORKER_URL,
    localReport: unknown = healthy,
  ) {
    const send = jest.fn().mockResolvedValue(undefined);
    const readiness = jest.fn().mockResolvedValue(localReport);
    const w = new HealthWatcherService(
      { readiness } as never,
      { send } as never,
      {
        get: (k: string) => {
          if (k === 'OPS_ALERT_EMAIL') return 'ops@example.com';
          if (k === 'WORKER_READY_URL') return workerReadyUrl ?? undefined;
          return undefined;
        },
      } as never,
    );
    const logger = (
      w as unknown as { logger: { error: () => void; log: () => void } }
    ).logger;
    jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    jest.spyOn(logger, 'log').mockImplementation(() => undefined);
    return { w, send, readiness };
  }

  /** A crash-looping worker, seen from here: nothing listening, no status to read. */
  function unreachable() {
    fetchMock.mockRejectedValue(
      new Error('connect ECONNREFUSED 10.0.0.4:3000'),
    );
  }

  function answersReady() {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => healthy,
    });
  }

  /** The worker answering but unready — the 503-with-detail health.controller.ts returns. */
  function answersUnready(detail: string) {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        ok: false,
        checkedAt: 'now',
        dependencies: { postgres: { ok: false, detail, ms: 12 } },
      }),
    });
  }

  it('does not probe at all when WORKER_READY_URL is unset', async () => {
    // Opt-in on purpose: there is no worker process in dev or test, and a probe failing every
    // minute locally is how a real alert gets tuned out.
    const { w, send } = watcher(null);
    await w.tick();
    await w.tick();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('does not alert on a single failed worker probe', async () => {
    const { w, send } = watcher();
    unreachable();
    await w.tick();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
  });

  it('alerts once the worker has failed twice, and names the worker', async () => {
    const { w, send } = watcher();
    unreachable();
    await w.tick();
    await w.tick();

    expect(send).toHaveBeenCalledTimes(1);
    const mail = send.mock.calls[0][0];
    expect(mail.to).toBe('ops@example.com');
    // "A dependency is unhealthy" would have left whoever read it to work out which process.
    expect(mail.subject).toContain('worker');
    expect(mail.text).toContain('worker');
    expect(mail.text).toContain(WORKER_URL);
    expect(mail.text).toContain('ECONNREFUSED');
  });

  it('names the failing dependency when the worker answers 503', async () => {
    const { w, send } = watcher();
    answersUnready('Authentication failed against database server (P1000)');
    await w.tick();
    await w.tick();

    const mail = send.mock.calls[0][0];
    expect(mail.text).toContain('returned 503');
    expect(mail.text).toContain('postgres');
    expect(mail.text).toContain('P1000');
  });

  it('does not repeat the worker alert every minute', async () => {
    const { w, send } = watcher();
    unreachable();
    for (let i = 0; i < 6; i++) await w.tick();
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('resets the latch on recovery, and can alert about the worker again', async () => {
    const { w, send } = watcher();

    unreachable();
    await w.tick();
    await w.tick(); // alert 1

    answersReady();
    await w.tick(); // recovery

    unreachable();
    await w.tick();
    await w.tick(); // alert 2

    expect(send.mock.calls.map((c) => c[0].subject)).toEqual([
      'ThreatLens: the worker process is down',
      'ThreatLens: the worker process recovered',
      'ThreatLens: the worker process is down',
    ]);
  });

  it('alerts about the worker even while a local dependency is also down', async () => {
    // Two separate counters and latches. Sharing them would mean a broken Redis swallowed the
    // alert about the worker — and two things breaking at once is when the second message
    // matters most.
    const { w, send } = watcher(WORKER_URL, localUnhealthy);
    unreachable();
    await w.tick();
    await w.tick();

    expect(send.mock.calls.map((c) => c[0].subject).sort()).toEqual([
      'ThreatLens: a dependency is down',
      'ThreatLens: the worker process is down',
    ]);
  });

  it('still probes the worker when the local readiness check throws', async () => {
    // The local check and the worker probe must not be able to cut each other short.
    const { w, send, readiness } = watcher();
    readiness.mockRejectedValue(new Error('boom'));
    unreachable();
    await expect(w.tick()).resolves.toBeUndefined();
    await w.tick();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].subject).toContain('worker');
  });

  it('gives the probe a deadline so a hung worker cannot stall the watcher', async () => {
    const { w } = watcher();
    answersReady();
    await w.tick();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(WORKER_URL);
    expect((init as { signal?: AbortSignal }).signal).toBeInstanceOf(
      AbortSignal,
    );
  });

  it('probes nothing when the watcher is disabled outright', async () => {
    // HEALTH_WATCHER_ENABLED=false has to switch off the whole watcher, worker probe included.
    const send = jest.fn().mockResolvedValue(undefined);
    const w = new HealthWatcherService(
      { readiness: jest.fn().mockResolvedValue(healthy) } as never,
      { send } as never,
      {
        get: (k: string) => {
          if (k === 'HEALTH_WATCHER_ENABLED') return 'false';
          if (k === 'WORKER_READY_URL') return WORKER_URL;
          if (k === 'OPS_ALERT_EMAIL') return 'ops@example.com';
          return undefined;
        },
      } as never,
    );
    jest
      .spyOn((w as unknown as { logger: { log: () => void } }).logger, 'log')
      .mockImplementation(() => undefined);

    w.onModuleInit();
    try {
      expect(
        (w as unknown as { timer?: NodeJS.Timeout }).timer,
      ).toBeUndefined();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    } finally {
      w.onModuleDestroy();
    }
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
