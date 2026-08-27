import { NotConnectedError } from "@/services/shared/not-connected-error";
import type { ReportsService } from "./reports-service";

export const apiReportsService: ReportsService = {
  listReports: () => {
    throw new NotConnectedError("ReportsService.listReports");
  },
};
