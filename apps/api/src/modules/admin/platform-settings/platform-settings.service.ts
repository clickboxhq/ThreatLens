import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

// The shape a platform admin edits. Deliberately NOT where secrets live — the transactional
// email API key, JWT signing secret and any provider credentials stay in environment
// variables (§5.17). This is behavioural configuration only.
export interface PlatformSettings {
  platformName: string;
  // When true, non-admin API traffic is turned away with 503 (MaintenanceMiddleware). Admins
  // and the auth endpoints stay reachable so the mode can be turned back off.
  maintenanceMode: boolean;
  // Self-serve signup. When false, POST /auth/signup is refused.
  registrationEnabled: boolean;
  // Days of trial granted to a new individual subscription once billing exists. Stored here
  // so it is tunable without a deploy; consumed by the future checkout flow.
  defaultTrialDays: number;
  featureFlags: Record<string, boolean>;
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  platformName: 'ThreatLens',
  maintenanceMode: false,
  registrationEnabled: true,
  defaultTrialDays: 7,
  featureFlags: {},
};

const SETTINGS_KEY = 'platform';
// A short in-process cache so the maintenance-mode check on every request is not a DB hit.
const CACHE_TTL_MS = 15_000;

@Injectable()
export class PlatformSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private cache: { value: PlatformSettings; at: number } | null = null;

  async get(): Promise<PlatformSettings> {
    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) {
      return this.cache.value;
    }
    const row = await this.prisma.platformSetting.findUnique({
      where: { key: SETTINGS_KEY },
    });
    const value: PlatformSettings = {
      ...DEFAULT_PLATFORM_SETTINGS,
      ...((row?.value as Partial<PlatformSettings> | undefined) ?? {}),
    };
    this.cache = { value, at: Date.now() };
    return value;
  }

  async update(
    patch: Partial<PlatformSettings>,
    actorUserId: string,
  ): Promise<PlatformSettings> {
    const current = await this.get();
    const next: PlatformSettings = {
      ...current,
      ...patch,
      featureFlags: { ...current.featureFlags, ...(patch.featureFlags ?? {}) },
    };
    await this.prisma.platformSetting.upsert({
      where: { key: SETTINGS_KEY },
      create: {
        key: SETTINGS_KEY,
        value: next as unknown as object,
        updatedBy: actorUserId,
      },
      update: { value: next as unknown as object, updatedBy: actorUserId },
    });
    this.cache = { value: next, at: Date.now() };
    return next;
  }
}
