import type { ThreatIntelService } from "./threat-intel-service";

const actors = [
  {
    name: "Storm-1811",
    region: "Eastern Europe",
    motive: "Financial",
    campaigns: 14,
    sev: "critical" as const,
  },
  {
    name: "APT29 (Midnight Blizzard)",
    region: "Russia",
    motive: "Espionage",
    campaigns: 22,
    sev: "high" as const,
  },
  {
    name: "Lazarus Group",
    region: "DPRK",
    motive: "Financial / Espionage",
    campaigns: 31,
    sev: "high" as const,
  },
  {
    name: "Scattered Spider",
    region: "US / UK",
    motive: "Extortion",
    campaigns: 18,
    sev: "critical" as const,
  },
];

const iocs = [
  {
    type: "domain",
    v: "adobe-secure-invoice.com",
    tags: ["phishing", "brand-impersonation"],
    sev: "high" as const,
  },
  { type: "ip", v: "185.220.101.44", tags: ["tor-exit", "phishing"], sev: "medium" as const },
  {
    type: "sha256",
    v: "a3f9cd12…7e14bc22",
    tags: ["cobalt-strike", "beacon"],
    sev: "critical" as const,
  },
  {
    type: "url",
    v: "hxxps://mkt-out.net/o/49x/",
    tags: ["tracker", "campaign"],
    sev: "low" as const,
  },
];

export const mockThreatIntelService: ThreatIntelService = {
  listActors: () => Promise.resolve(actors),
  listIocs: () => Promise.resolve(iocs),
};
