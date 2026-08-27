import type { LucideIcon } from "lucide-react";
import type { Severity } from "./common";

export type ScenarioEventSource = { icon: LucideIcon; label: string; count: number };

export type ScenarioDraftEvent = {
  t: string;
  src: string;
  detail: string;
  mitre: string;
  sev: Severity;
};

export type ScenarioConfigRow = { k: string; v: string };
