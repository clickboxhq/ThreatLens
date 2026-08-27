import type { SettingsService } from "./settings-service";

const sections = [
  "General",
  "Security",
  "Single sign-on",
  "Notifications",
  "Integrations",
  "API keys",
  "Audit log",
  "Billing",
];

const securityToggles = [
  { label: "Enforce SSO for all analysts", on: true },
  { label: "Require hardware key MFA for Tier 3", on: true },
  { label: "Session inactivity timeout — 15 minutes", on: true },
  { label: "Block sign-in from anonymized networks", on: false },
];

const dataResidencyRegions = [
  { label: "EU-West (Frankfurt)", selected: true },
  { label: "US-East (Virginia)", selected: false },
  { label: "APAC (Singapore)", selected: false },
];

export const mockSettingsService: SettingsService = {
  listSections: () => Promise.resolve(sections),
  listSecurityToggles: () => Promise.resolve(securityToggles),
  listDataResidencyRegions: () => Promise.resolve(dataResidencyRegions),
};
