import { useSoc } from "@/lib/store";
import { incidentsService } from "@/services/incidents";

export function useIncidents() {
  const incidents = useSoc((s) => s.incidents);
  return {
    incidents,
    setIncidentStatus: incidentsService.setIncidentStatus,
    addIncidentNote: incidentsService.addIncidentNote,
  };
}
