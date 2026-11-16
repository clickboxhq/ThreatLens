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

// A probe that hangs is a probe that never reports. Kept well under POLL_INTERVAL_MS so a
// stuck request cannot still be in flight when the next tick starts.
const WORKER_PROBE_TIMEOUT_MS = 10_000;

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
 * Watches two things, for that same reason:
 *
 *  1. This process's own dependencies, via HealthService.
 *  2. The `worker` process, by fetching its /ready over Railway's private network
 *     (WORKER_READY_URL). The worker is what runs the BullMQ consumers, so this probe
 *     deliberately does not go through a queue either — a worker outage must not be able to
 *     suppress the alert about the worker. An HTTP request from the API's own timer shares
 *     nothing with it.
 *
 * The second one was added after the 2026-11-14 outage: `worker` crash-looped for two days on
 * a stale password in its own copy of DATABASE_URL (P1000) and nothing noticed, because
 * worker.module.ts registers HealthService but not this watcher — the worker had a /ready
 * endpoint the whole time and nobody polled it. Same failure class as 2026-10-04, found the
 * same way: a person looking at a dashboard.
 *
 * It still does not replace an external uptime monitor. This lives inside the API process, so
 * it cannot report that the API itself is gone — point something at /ready from outside for
 * that. What it covers is the far more likely case seen twice now: a process is up and
 * something it needs, or something beside it, is not.
 */
@Injectable()
export class HealthWatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HealthWatcherService.name);
  private timer?: NodeJS.Timeout;
  private consecutiveFailures = 0;
  private alerted = false;
  // Counted and latched separately from the local dependencies above. One shared latch would
  // mean a failing Redis suppressed the alert about the worker, and the other way round — two
  // things breaking at once is exactly when the second message matters most.
  private workerConsecutiveFailures = 0;
  private workerAlerted = false;

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

    // Said once, at startup, rather than on every tick. Unset is the right state in dev and
    // test — there is no worker process to probe — but in production it means the gap that let
    // the 2026-11-14 outage run for two days is still open, so it should not be silent.
    const workerUrl = this.workerReadyUrl();
    if (workerUrl) {
      this.logger.log(`Also watching the worker process at ${workerUrl}.`);
    } else {
      this.logger.log(
        'WORKER_READY_URL is unset, so nothing is watching the worker process. ' +
          'On Railway, set it on the api service to http://worker.railway.internal:3000/ready.',
      );
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
    // allSettled, not all: the two checks watch different things, and neither may be skipped
    // or cut short because the other failed. It also keeps a rejection out of the timer's
    // `void this.tick()`, where it would surface as an unhandled rejection.
    const results = await Promise.allSettled([
      this.checkLocalDependencies(),
      this.checkWorker(),
    ]);
    for (const result of results) {
      if (result.status === 'rejected') {
        const reason: unknown = result.reason;
        this.logger.error(
          `Health watcher check threw: ${reason instanceof Error ? reason.message : String(reason)}`,
        );
      }
    }
  }

  private async checkLocalDependencies(): Promise<void> {
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
    const broken = describeBroken(report.dependencies);

    this.logger.error(
      `Readiness check failed (${this.consecutiveFailures}/${FAILURES_BEFORE_ALERT}) — ${broken}`,
    );

    if (this.consecutiveFailures >= FAILURES_BEFORE_ALERT && !this.alerted) {
      this.alerted = true;
      await this.announceFailure(broken);
    }
  }

  private async checkWorker(): Promise<void> {
    const url = this.workerReadyUrl();
    // Opt-in, so it is absent in dev and test where nothing is listening and a failing probe
    // every minute would be noise. onModuleInit has already logged which state this is in.
    if (!url) return;

    const failure = await this.probeWorker(url);

    if (!failure) {
      if (this.workerAlerted) await this.announceWorkerRecovery();
      this.workerConsecutiveFailures = 0;
      this.workerAlerted = false;
      return;
    }

    this.workerConsecutiveFailures += 1;
    this.logger.error(
      `Worker readiness check failed (${this.workerConsecutiveFailures}/${FAILURES_BEFORE_ALERT}) — ${failure}`,
    );

    if (
      this.workerConsecutiveFailures >= FAILURES_BEFORE_ALERT &&
      !this.workerAlerted
    ) {
      this.workerAlerted = true;
      await this.announceWorkerFailure(url, failure);
    }
  }

  /** null when the worker answered healthy; otherwise why it did not. */
  private async probeWorker(url: string): Promise<string | null> {
    let res: Response;
    try {
      res = await fetch(url, {
        signal: AbortSignal.timeout(WORKER_PROBE_TIMEOUT_MS),
        headers: { accept: 'application/json' },
      });
    } catch (err) {
      // What a crash-looping worker looks like from here: nothing is listening, so the
      // connection is refused before there is any status to read.
      return `could not reach ${url} — ${err instanceof Error ? err.message : String(err)}`;
    }

    if (res.ok) return null;

    // /ready answers 503 with per-dependency detail, so the alert can name what is broken
    // inside the worker rather than just reporting a status code.
    const detail = await readUnreadyDetail(res);
    return `${url} returned ${res.status}${detail ? ` — ${detail}` : ''}`;
  }

  private workerReadyUrl(): string | null {
    return this.config.get<string>('WORKER_READY_URL')?.trim() || null;
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
      // An outage alert is the message that can least afford to be filtered, and HTML with no
      // text part is one of the things filters hold against a sender.
      text: [
        'ThreatLens readiness check is failing.',
        '',
        broken,
        '',
        'Users are likely affected. Check the API logs and the dependency itself.',
        'This alert repeats only when the state changes, not every minute.',
        '',
      ].join('\n'),
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
      text: [
        'The ThreatLens readiness check is passing again.',
        '',
        `Recovered at ${report.checkedAt}.`,
        '',
      ].join('\n'),
    });
  }

  /**
   * Names the worker, the URL probed, and what stops working while it is down.
   *
   * Deliberately specific. The 2026-11-14 outage was a crash-looping worker for two days; an
   * alert that only said "unhealthy" would still have cost most of a day working out which
   * process, which is most of what the alert is meant to save.
   */
  private async announceWorkerFailure(
    url: string,
    failure: string,
  ): Promise<void> {
    const to = this.alertAddress();
    if (!to) {
      this.logger.error(
        `ALERT (no OPS_ALERT_EMAIL configured, so this went nowhere) — ThreatLens worker down: ${failure}`,
      );
      return;
    }
    const consequence =
      'No background jobs run while it is down: telemetry generation, alert correlation and ' +
      'scoring all stall, so investigation sessions stop producing anything. The API itself ' +
      'keeps answering normally, which is what makes this easy to miss.';
    const whereToLook =
      'Check the worker service deploy logs in Railway. A crash loop at startup — a stale ' +
      'DATABASE_URL, for instance — looks exactly like this from here.';
    await this.email.send({
      to,
      subject: 'ThreatLens: the worker process is down',
      html: [
        '<p><strong>The ThreatLens worker process is not reporting healthy.</strong></p>',
        `<p>${escapeBasic(failure)}</p>`,
        `<p>${consequence}</p>`,
        `<p>${whereToLook}</p>`,
        '<p>This alert repeats only when the state changes, not every minute.</p>',
      ].join(''),
      text: [
        'The ThreatLens worker process is not reporting healthy.',
        '',
        failure,
        '',
        consequence,
        '',
        whereToLook,
        '',
        'This alert repeats only when the state changes, not every minute.',
        '',
      ].join('\n'),
    });
    this.logger.error(`Worker-down alert sent to ${to}: ${failure}`);
  }

  private async announceWorkerRecovery(): Promise<void> {
    const to = this.alertAddress();
    this.logger.log('Worker readiness recovered.');
    if (!to) return;
    const recoveredAt = new Date().toISOString();
    await this.email.send({
      to,
      subject: 'ThreatLens: the worker process recovered',
      html: [
        '<p>The ThreatLens worker process is reporting healthy again.</p>',
        `<p>Recovered at ${escapeBasic(recoveredAt)}.</p>`,
        '<p>Queued jobs resume on their own; check the queue depth if it was down a while.</p>',
      ].join(''),
      text: [
        'The ThreatLens worker process is reporting healthy again.',
        '',
        `Recovered at ${recoveredAt}.`,
        '',
        'Queued jobs resume on their own; check the queue depth if it was down a while.',
        '',
      ].join('\n'),
    });
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}

/** "postgres: connection refused; redis: MISCONF ..." — what an alert body leads with. */
function describeBroken(dependencies: ReadinessReport['dependencies']): string {
  return Object.entries(dependencies)
    .filter(([, d]) => !d?.ok)
    .map(([name, d]) => `${name}: ${d?.detail ?? 'unknown'}`)
    .join('; ');
}

/** Pulls the failing dependencies out of a 503 from /ready, or null if the body is unusable. */
async function readUnreadyDetail(res: Response): Promise<string | null> {
  const body = (await res
    .json()
    .catch(() => null)) as Partial<ReadinessReport> | null;
  if (!body?.dependencies) return null;
  return describeBroken(body.dependencies) || null;
}

/** Alert bodies are built from error text, not user input, but it still goes into HTML. */
function escapeBasic(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
