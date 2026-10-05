import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';
import { HealthService, type ReadinessReport } from './health.service';

const POLL_INTERVAL_MS = 60_000;

// Two consecutive failures before shouting. One failed probe is as likely to be a dropped
// packet as an outage, and an alerting channel that cries wolf gets muted — which is the same
// end state as having no alerting at all.
const FAILURES_BEFORE_ALERT = 2;

/**
 * Notices when a dependency breaks, and tells somebody.
 *
 * The gap this fills is not detection — /ready does that — but the hour of the night when
 * nobody is looking at it. The 2026-10-04 outage ran for about a day and was reported by a
 * person trying to sign up, not by any system.
 *
 * Runs on a plain timer rather than the BullMQ scheduler on purpose. The queue is backed by
 * Redis, so a Redis outage would take the scheduler down with it and the alert about Redis
 * being broken would never fire. An alerting path must not share a dependency with the thing
 * it watches.
 *
 * It does not replace an external uptime monitor. This lives inside the API process, so it
 * cannot report that the API itself is gone — point something at /ready from outside for that.
 * What it covers is the far more likely case seen here: the process is healthy and something
 * underneath it is not.
 */
@Injectable()
export class HealthWatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HealthWatcherService.name);
  private timer?: NodeJS.Timeout;
  private consecutiveFailures = 0;
  private alerted = false;

  constructor(
    private readonly health: HealthService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    if (this.config.get<string>('HEALTH_WATCHER_ENABLED') === 'false') {
      this.logger.log('Health watcher disabled by configuration.');
      return;
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, POLL_INTERVAL_MS);
    // Unref so a background timer cannot hold the process open on shutdown, or keep a test
    // runner alive after its assertions finish.
    this.timer.unref?.();
  }

  /** Exposed for tests; the timer calls it. */
  async tick(): Promise<void> {
    let report: ReadinessReport;
    try {
      report = await this.health.readiness();
    } catch (err) {
      this.logger.error(
        `Health probe itself failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }

    if (report.ok) {
      if (this.alerted) await this.announceRecovery(report);
      this.consecutiveFailures = 0;
      this.alerted = false;
      return;
    }

    this.consecutiveFailures += 1;
    const broken = Object.entries(report.dependencies)
      .filter(([, d]) => !d.ok)
      .map(([name, d]) => `${name}: ${d.detail ?? 'unknown'}`)
      .join('; ');

    this.logger.error(
      `Readiness check failed (${this.consecutiveFailures}/${FAILURES_BEFORE_ALERT}) — ${broken}`,
    );

    if (this.consecutiveFailures >= FAILURES_BEFORE_ALERT && !this.alerted) {
      this.alerted = true;
      await this.announceFailure(broken);
    }
  }

  private alertAddress(): string | null {
    return this.config.get<string>('OPS_ALERT_EMAIL')?.trim() || null;
  }

  private async announceFailure(broken: string): Promise<void> {
    const to = this.alertAddress();
    if (!to) {
      // Logged loudly rather than silently skipped: an alerting system that is not configured
      // should say so, not look like one that is working.
      this.logger.error(
        `ALERT (no OPS_ALERT_EMAIL configured, so this went nowhere) — ThreatLens dependency down: ${broken}`,
      );
      return;
    }
    await this.email.send({
      to,
      subject: 'ThreatLens: a dependency is down',
      html: [
        '<p><strong>ThreatLens readiness check is failing.</strong></p>',
        `<p>${escapeBasic(broken)}</p>`,
        '<p>Users are likely affected. Check the API logs and the dependency itself.</p>',
        '<p>This alert repeats only when the state changes, not every minute.</p>',
      ].join(''),
    });
    this.logger.error(`Dependency-down alert sent to ${to}: ${broken}`);
  }

  private async announceRecovery(report: ReadinessReport): Promise<void> {
    const to = this.alertAddress();
    this.logger.log('Readiness recovered.');
    if (!to) return;
    await this.email.send({
      to,
      subject: 'ThreatLens: dependencies recovered',
      html: [
        '<p>The ThreatLens readiness check is passing again.</p>',
        `<p>Recovered at ${escapeBasic(report.checkedAt)}.</p>`,
      ].join(''),
    });
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}

/** Alert bodies are built from error text, not user input, but it still goes into HTML. */
function escapeBasic(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
