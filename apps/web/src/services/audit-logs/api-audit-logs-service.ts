import { NotConnectedError } from "@/services/shared/not-connected-error";
import type { AuditLogsService } from "./audit-logs-service";

const notConnected = (method: string): never => {
  throw new NotConnectedError(`AuditLogsService.${method}`);
};

export const apiAuditLogsService: AuditLogsService = {
  listEntries: () => notConnected("listEntries"),
  getStats: () => notConnected("getStats"),
  listCategories: () => notConnected("listCategories"),
};
