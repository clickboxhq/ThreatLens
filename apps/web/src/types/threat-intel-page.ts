import type { Severity } from "./common";

export type ThreatActor = {
  name: string;
  region: string;
  motive: string;
  campaigns: number;
  sev: Severity;
};

export type IocSighting = {
  type: string;
  v: string;
  tags: string[];
  sev: Severity;
};
