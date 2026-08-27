import { signedOverTime, mitreCoverage } from "@/lib/soc-data";
import type { AnalyticsService } from "./analytics-service";

const meantime = [
  { d: "Mon", mttd: 6.1, mttr: 42 },
  { d: "Tue", mttd: 5.4, mttr: 38 },
  { d: "Wed", mttd: 4.8, mttr: 35 },
  { d: "Thu", mttd: 5.1, mttr: 33 },
  { d: "Fri", mttd: 4.2, mttr: 29 },
  { d: "Sat", mttd: 3.9, mttr: 27 },
  { d: "Sun", mttd: 3.7, mttr: 26 },
];

export const mockAnalyticsService: AnalyticsService = {
  listSignedOverTime: () => Promise.resolve(signedOverTime),
  listMeanTime: () => Promise.resolve(meantime),
  listMitreCoverage: () => Promise.resolve(mitreCoverage),
};
