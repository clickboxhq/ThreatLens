import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * The single write path for `User.lastMeaningfulActivityAt` — the source of truth for both the
 * "Active" presence indicator and the inactivity-reminder cycle. Two callers: ActivityInterceptor
 * (HTTP routes explicitly marked @TracksActivity()) and CertificatesService (certificate
 * issuance runs in the worker process, off the back of async scoring, not an HTTP request, so it
 * can't go through the interceptor and calls this directly instead).
 *
 * Deliberately never login, notifications, polling, or token refresh — only genuine
 * investigation/learning work. Never throws: a presence-tracking failure must never affect the
 * real request or job it's attached to.
 */
@Injectable()
export class ActivityTrackingService {
  private readonly logger = new Logger(ActivityTrackingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async touch(userId: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { lastMeaningfulActivityAt: new Date() },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to record activity for user ${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
