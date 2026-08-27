import { useSoc } from "@/lib/store";
import type { IncidentsService } from "./incidents-service";

export const mockIncidentsService: IncidentsService = {
  listIncidents: () => useSoc.getState().incidents,
  setIncidentStatus: (id, status) => useSoc.getState().setIncidentStatus(id, status),
  addIncidentNote: (id, note) => useSoc.getState().addIncidentNote(id, note),
};
