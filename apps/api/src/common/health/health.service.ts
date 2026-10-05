import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';

export interface DependencyHealth {
  ok: boolean;
  detail?: string;
  /** How long the probe took, which is often the first sign of trouble before it fails outright. */
  ms: number;
}

export interface ReadinessReport {
  ok: boolean;
  checkedAt: string;
  dependencies: Record<string, DependencyHealth>;
}

/**
 * Readiness probes that actually exercise the dependencies.
 *
 * Written after the 2026-10-04 outage, in which /health returned {status:'ok'} for about a day
 * while nobody could authenticate. The endpoint reported on nothing but its own ability to
 * return a literal, which is worse than having no check: it gave a confident green signal
 * through a total outage.
 *
 * The Redis probe writes, and that is the whole point. The fault was a volume forced read-only,
 * so Redis stayed up, held its connections, answered PING, and served every read — while
 * refusing every write. A liveness-style ping would have been green throughout. The only probe
 * that would have caught it is one that tries to put a byte somewhere.
 */
@Injectable()
export class HealthService implements OnModuleDestroy {
  private readonly logger = new Logger(HealthService.name);
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.redis = new Redis(
      config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
      {
        // A probe must fail fast and say so, not queue up behind retries until the HTTP
        // request times out — a hanging health check reads as "down" to a monitor anyway, but
        // without telling anyone why.
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      },
    );
    this.redis.on('error', () => {
      // Swallowed deliberately: an unhandled 'error' on an ioredis client takes the process
      // down, and the probe below reports the failure properly.
    });
  }

  async readiness(): Promise<ReadinessReport> {
    const [postgres, redis] = await Promise.all([
      this.timed(() => this.probePostgres()),
      this.timed(() => this.probeRedis()),
    ]);

    return {
      ok: postgres.ok && redis.ok,
      checkedAt: new Date().toISOString(),
      dependencies: { postgres, redis },
    };
  }

  private async probePostgres(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }

  /**
   * Write, read back, delete.
   *
   * Each step matters. The write is what catches a read-only volume or a full disk. Reading it
   * back catches a server that accepted the write and dropped it. The TTL means an abandoned
   * probe key cannot accumulate if the delete never runs.
   */
  private async probeRedis(): Promise<void> {
    const key = `health:probe:${process.pid}`;
    const value = String(Date.now());
    await this.redis.set(key, value, 'EX', 30);
    const readBack = await this.redis.get(key);
    if (readBack !== value) {
      throw new Error(
        `wrote ${value} but read back ${readBack ?? 'nothing'} — Redis is not retaining writes`,
      );
    }
    await this.redis.del(key);
  }

  private async timed(op: () => Promise<void>): Promise<DependencyHealth> {
    const started = Date.now();
    try {
      await op();
      return { ok: true, ms: Date.now() - started };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return { ok: false, detail, ms: Date.now() - started };
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }
}
