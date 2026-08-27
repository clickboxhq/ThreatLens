import type { Alert, AlertStatus } from "@/types/alerts";
import type { Note } from "@/types/common";

export interface AlertsService {
  listAlerts(): Alert[];
  setAlertStatus(id: string, status: AlertStatus): void;
  assignAlert(id: string, analyst: string): void;
  resolveAlert(id: string): void;
  escalateAlert(id: string): void;
  addAlertNote(id: string, note: Omit<Note, "id" | "ts">): void;
  dismissAlert(id: string, reason: string): void;
  promoteAlert(id: string, incidentId: string): void;
}
