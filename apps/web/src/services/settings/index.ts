import { apiSettingsService } from "./api-settings-service";
import type { SettingsService } from "./settings-service";

export const settingsService: SettingsService = apiSettingsService;
export type { SettingsService } from "./settings-service";
