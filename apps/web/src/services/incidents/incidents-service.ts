import type { Incident } from "@/types/incidents";
import type { Note } from "@/types/common";

export interface IncidentsService {
  listIncidents(): Incident[];
  setIncidentStatus(id: string, status: string): void;
  addIncidentNote(id: string, note: Omit<Note, "id" | "ts">): void;
}
