import type { SettingsService } from "./settings-service";
import { mockSettingsService } from "./mock-settings-service";

export const settingsService: SettingsService = mockSettingsService;
export type { SettingsService } from "./settings-service";
