import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditLogService } from '../../../common/audit-log/audit-log.service';
import {
  PlatformSettingsService,
  type PlatformSettings,
} from '../platform-settings/platform-settings.service';
import { ADMIN_AUDIT } from '../admin-audit';
import type { AuthenticatedUser } from '../../../common/guards/jwt-auth.guard';

// Thin admin wrapper over PlatformSettingsService: same read, but every write is audited with
// a field-level diff so the Audit Logs view shows exactly what changed.
@Injectable()
export class AdminSettingsService {
  constructor(
    private readonly settings: PlatformSettingsService,
    private readonly auditLog: AuditLogService,
  ) {}

  get(): Promise<PlatformSettings> {
    return this.settings.get();
  }

  async update(
    admin: AuthenticatedUser,
    patch: Partial<PlatformSettings>,
    actorIp?: string,
  ): Promise<PlatformSettings> {
    const before = await this.settings.get();
    const after = await this.settings.update(patch, admin.id);

    const changed: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of Object.keys(patch) as (keyof PlatformSettings)[]) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        changed[key] = { from: before[key], to: after[key] };
      }
    }

    if (Object.keys(changed).length > 0) {
      await this.auditLog.record({
        actorUserId: admin.id,
        actorIp: actorIp ?? null,
        action: ADMIN_AUDIT.settingsUpdated,
        targetType: 'platform_settings',
        targetId: null,
        metadata: { changed } as Prisma.InputJsonValue,
      });
    }
    return after;
  }
}
