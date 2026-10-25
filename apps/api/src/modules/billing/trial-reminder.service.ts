import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';
import { trialEndingEmail } from '../../common/email/email-templates';

const POLL_INTERVAL_MS = 60 * 60 * 1000;
/** How far ahead of the charge to warn. Two days leaves a working day to act. */
const REMIND_DAYS_BEFORE = 2;

const NGN = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});

const DATE = new Intl.DateTimeFormat('en-NG', {
  day: 'numeric',
  month: 'long',
  timeZone: 'Africa/Lagos',
});

/**
 * Warns people before a free trial becomes a charge.
 *
 * A card-upfront trial that debits without notice is the shape of thing people dispute with
 * their bank rather than with us, and a chargeback costs the fee, the revenue and some of the
 * sending reputation the DNS work was set up to protect. This is the cheapest insurance
 * against that, and the right thing to do regardless.
 *
 * Follows HealthWatcherService's plain-timer pattern rather than introducing a BullMQ
 * repeatable job, since there is no second scheduling mechanism in this codebase yet and one
 * timer is less machinery than one queue.
 *
 * The row is claimed before the email is sent, never after. If the API ever runs more than
 * one replica, every replica runs this loop, and claiming afterwards would mean each of them
 * finding the same unsent subscription and emailing the same person. The claim is a
 * conditional update whose count tells us whether we won it.
 */
@Injectable()
export class TrialReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrialReminderService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.run();
    }, POLL_INTERVAL_MS);
    // Does not hold the process open — this must never be the reason a deploy cannot drain.
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Exposed for tests and for a manual run; safe to call at any time. */
  async run(): Promise<number> {
    const cutoff = new Date(Date.now() + REMIND_DAYS_BEFORE * 86400000);

    const due = await this.prisma.subscription.findMany({
      where: {
        status: 'trialing',
        trialReminderSentAt: null,
        trialEndsAt: { lte: cutoff, gt: new Date() },
        userId: { not: null },
      },
      select: {
        id: true,
        trialEndsAt: true,
        planId: true,
        user: { select: { email: true, displayName: true } },
      },
    });

    let sent = 0;
    for (const subscription of due) {
      if (!subscription.user || !subscription.trialEndsAt) continue;

      // Claim it first. The count is zero if another replica got there, in which case this
      // one must not also send.
      const claimed = await this.prisma.subscription.updateMany({
        where: { id: subscription.id, trialReminderSentAt: null },
        data: { trialReminderSentAt: new Date() },
      });
      if (claimed.count === 0) continue;

      try {
        await this.email.send({
          to: subscription.user.email,
          ...trialEndingEmail({
            displayName: subscription.user.displayName,
            amount: NGN.format(this.monthlyNgnFor(subscription.planId)),
            chargeDate: DATE.format(subscription.trialEndsAt),
            manageUrl: `${this.webOrigin()}/app/billing`,
          }),
        });
        sent += 1;
      } catch (err) {
        // Release the claim so the next pass retries. Better a late warning than none —
        // and the alternative is charging somebody who was never told.
        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: { trialReminderSentAt: null },
        });
        this.logger.error(
          `Trial reminder for subscription ${subscription.id} failed: ${(err as Error).message}`,
        );
      }
    }

    if (sent > 0) this.logger.log(`Sent ${sent} trial-ending reminder(s).`);
    return sent;
  }

  private monthlyNgnFor(planId: string): number {
    return planId === 'organization' ? 15_000 : 10_000;
  }

  private webOrigin(): string {
    return this.config.get<string>('WEB_ORIGIN') ?? 'https://threatlensapp.com';
  }
}
