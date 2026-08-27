import type { StudentAnalyticsService } from "./student-analytics-service";

const students = [
  {
    name: "Elena Rossi",
    cohort: "CH-2026-A",
    inv: 148,
    acc: 94,
    evid: 96,
    mitre: 82,
    risk: "Low" as const,
  },
  {
    name: "Marcus Chen",
    cohort: "CH-2026-B",
    inv: 141,
    acc: 91,
    evid: 93,
    mitre: 79,
    risk: "Low" as const,
  },
  {
    name: "Priya Nair",
    cohort: "CH-2026-C",
    inv: 133,
    acc: 90,
    evid: 88,
    mitre: 76,
    risk: "Low" as const,
  },
  {
    name: "Yusuf Demir",
    cohort: "CH-2026-A",
    inv: 129,
    acc: 84,
    evid: 81,
    mitre: 68,
    risk: "Medium" as const,
  },
  {
    name: "Amelia Ward",
    cohort: "CH-2026-A",
    inv: 121,
    acc: 76,
    evid: 69,
    mitre: 58,
    risk: "High" as const,
  },
  {
    name: "Daniel Holt",
    cohort: "CH-2026-D",
    inv: 64,
    acc: 68,
    evid: 62,
    mitre: 44,
    risk: "High" as const,
  },
];

const failureModes = [
  { label: "Missing message trace", value: "34 cases", meter: 68 },
  { label: "No conditional-access check", value: "27 cases", meter: 54 },
  { label: "Unmapped technique", value: "22 cases", meter: 44 },
  { label: "Closed without conclusion", value: "9 cases", meter: 18 },
];

export const mockStudentAnalyticsService: StudentAnalyticsService = {
  listStudents: () => Promise.resolve(students),
  getStats: () =>
    Promise.resolve({ analystsTracked: 128, cohortAccuracy: 78, evidenceRate: 84, atRisk: 7 }),
  listFailureModes: () => Promise.resolve(failureModes),
};
