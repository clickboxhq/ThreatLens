import type { SecurityToggle, DataResidencyRegion, SettingsSection } from "@/types/settings";

export interface SettingsService {
  listSections(): Promise<SettingsSection[]>;
  listSecurityToggles(): Promise<SecurityToggle[]>;
  listDataResidencyRegions(): Promise<DataResidencyRegion[]>;
}
