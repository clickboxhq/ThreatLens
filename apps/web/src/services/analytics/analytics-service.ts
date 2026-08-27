import type { SignedOverTimePoint, MeanTimePoint } from "@/types/analytics";
import type { MitreCoverage } from "@/types/mitre-explorer";

export interface AnalyticsService {
  listSignedOverTime(): Promise<SignedOverTimePoint[]>;
  listMeanTime(): Promise<MeanTimePoint[]>;
  listMitreCoverage(): Promise<MitreCoverage[]>;
}
