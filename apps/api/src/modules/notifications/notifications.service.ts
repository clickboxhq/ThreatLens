import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app-exception';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import type { NotificationCategory } from '@prisma/client';

const LIST_LIMIT = 50; // most-recent window — no cursor pagination anywhere else in this
// codebase yet (search/admin audit log both use a plain fixed `take`), so this matches.

// §Phase 6 (merge plan): net-new, no prior real concept. Every domain service that should
// surface something to a user calls create() directly (this module is @Global, same reason
// AuditLogModule is: used by unrelated modules — Scoring/Certificates in the worker process,
// Instructor/Organizations in the API process — that shouldn't depend on each other just to
// share this) rather than writing the row itself, mirroring AuditLogService's own pattern.
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(params: {
    userId: string;
    category: NotificationCategory;
    title: string;
    body: string;
    link?: string;
  }): Promise<void> {
    await this.prisma.notification.create({
      data: {
        userId: params.userId,
        category: params.category,
        title: params.title,
        body: params.body,
        link: params.link ?? null,
      },
    });
  }

  /**
   * Fan the same notification out to many users in one insert — for
   * broadcasts (org announcements) where a per-recipient loop would be a
   * round-trip each.
   */
  async createMany(params: {
    userIds: string[];
    category: NotificationCategory;
    title: string;
    body: string;
    link?: string;
  }): Promise<void> {
    if (params.userIds.length === 0) return;
    await this.prisma.notification.createMany({
      data: params.userIds.map((userId) => ({
        userId,
        category: params.category,
        title: params.title,
        body: params.body,
        link: params.link ?? null,
      })),
    });
  }

  async listMine(user: AuthenticatedUser) {
    const notifications = await this.prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: LIST_LIMIT,
    });
    return notifications.map(toDto);
  }

  async markAsRead(user: AuthenticatedUser, id: string): Promise<void> {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!notification || notification.userId !== user.id) {
      throw new AppException(404, 'NOT_FOUND', 'Notification not found.');
    }
    if (notification.read) return; // idempotent — matches markAllAsRead's spirit
    await this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });
  }

  async markAllAsRead(user: AuthenticatedUser): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    });
  }
}

function toDto(n: {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: Date;
}) {
  return {
    id: n.id,
    category: n.category,
    title: n.title,
    body: n.body,
    link: n.link,
    read: n.read,
    createdAt: n.createdAt,
  };
}
