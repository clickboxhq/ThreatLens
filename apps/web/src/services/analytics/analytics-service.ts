import type { InvestigationActivityPoint, TimeToResolutionPoint } from "@/types/analytics";
import type { MitreCoverage } from "@/types/mitre-explorer";

export interface AnalyticsService {
  listInvestigationActivity(): Promise<InvestigationActivityPoint[]>;
  listTimeToResolution(): Promise<TimeToResolutionPoint[]>;
  listMitreCoverage(): Promise<MitreCoverage[]>;
}
