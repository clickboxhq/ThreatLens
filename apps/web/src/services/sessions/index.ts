import { apiSessionsService } from "./api-sessions-service";
import type { SessionsService } from "./sessions-service";

export const sessionsService: SessionsService = apiSessionsService;

export type { SessionsService } from "./sessions-service";
