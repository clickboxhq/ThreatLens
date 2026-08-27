import { NotConnectedError } from "@/services/shared/not-connected-error";
import type { SettingsService } from "./settings-service";

const notConnected = (method: string): never => {
  throw new NotConnectedError(`SettingsService.${method}`);
};

export const apiSettingsService: SettingsService = {
  listSections: () => notConnected("listSections"),
  listSecurityToggles: () => notConnected("listSecurityToggles"),
  listDataResidencyRegions: () => notConnected("listDataResidencyRegions"),
};
