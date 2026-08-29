import { apiClient } from "@/lib/api-client";
import type { SettingsService } from "./settings-service";
import type { MfaStatus, MfaSetup } from "@/types/settings";

export const apiSettingsService: SettingsService = {
  getMfaStatus: () => apiClient.get<MfaStatus>("/auth/mfa/status"),

  setupMfa: () => apiClient.post<MfaSetup>("/auth/mfa/setup"),

  enableMfa: (code) => apiClient.post<{ recoveryCodes: string[] }>("/auth/mfa/enable", { code }),

  disableMfa: async (password) => {
    await apiClient.post("/auth/mfa/disable", { password });
  },
};
