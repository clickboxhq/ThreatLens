import { NotConnectedError } from "@/services/shared/not-connected-error";
import type { IncidentsService } from "./incidents-service";

const notConnected = (method: string): never => {
  throw new NotConnectedError(`IncidentsService.${method}`);
};

export const apiIncidentsService: IncidentsService = {
  listIncidents: () => notConnected("listIncidents"),
  setIncidentStatus: () => notConnected("setIncidentStatus"),
  addIncidentNote: () => notConnected("addIncidentNote"),
};
