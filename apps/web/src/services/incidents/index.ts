import type { IncidentsService } from "./incidents-service";
import { mockIncidentsService } from "./mock-incidents-service";

export const incidentsService: IncidentsService = mockIncidentsService;
export type { IncidentsService } from "./incidents-service";
