import type { MfaStatus, MfaSetup } from "@/types/settings";

export interface SettingsService {
  getMfaStatus(): Promise<MfaStatus>;
  setupMfa(): Promise<MfaSetup>;
  enableMfa(code: string): Promise<{ recoveryCodes: string[] }>;
  disableMfa(password: string): Promise<void>;
}
