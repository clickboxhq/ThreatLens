import type { Note, Severity } from "./common";
import type { AlertStatus } from "./alerts";

export type Incident = {
  id: string;
  title: string;
  severity: Severity;
  status: AlertStatus;
  entities: number;
  alerts: number;
  owner: string;
  updated: string;
  notes?: Note[];
};
