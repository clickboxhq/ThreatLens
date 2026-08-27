import type { Note, Severity } from "./common";

export type AlertStatus = "new" | "open" | "in-progress" | "escalated" | "resolved" | "closed";

export type Alert = {
  id: string;
  name: string;
  severity: Severity;
  status: AlertStatus;
  analyst: string;
  rule: string;
  mitre: string;
  ts: string;
  source: string;
  user: string;
  device: string;
  notes?: Note[];
  dismissReason?: string;
  incidentId?: string;
};
