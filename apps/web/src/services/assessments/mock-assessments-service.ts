import type { AssessmentsService } from "./assessments-service";

const rows = [
  {
    id: "AS-114",
    name: "Tier 1 Certification — Identity Attacks",
    cohort: "CH-2026-A",
    window: "Aug 18 – Aug 22",
    submitted: 38,
    total: 42,
    avg: 84,
    status: "in-progress" as const,
  },
  {
    id: "AS-113",
    name: "BEC Investigation Practical",
    cohort: "CH-2026-A",
    window: "Aug 04 – Aug 08",
    submitted: 42,
    total: 42,
    avg: 88,
    status: "resolved" as const,
  },
  {
    id: "AS-112",
    name: "Endpoint Forensics Practical",
    cohort: "CH-2026-C",
    window: "Jul 28 – Aug 01",
    submitted: 18,
    total: 18,
    avg: 91,
    status: "resolved" as const,
  },
  {
    id: "AS-111",
    name: "Threat Hunting Hypothesis Exercise",
    cohort: "CH-2026-B",
    window: "Aug 25 – Aug 29",
    submitted: 0,
    total: 24,
    avg: 0,
    status: "open" as const,
  },
];

const gradingBreakdown = [
  { label: "Conclusion accuracy", value: "89%", meter: 89 },
  { label: "Evidence completeness", value: "91%", meter: 91 },
  { label: "ATT&CK mapping", value: "78%", meter: 78 },
  { label: "Report quality", value: "72%", meter: 72 },
];

export const mockAssessmentsService: AssessmentsService = {
  listAssessments: () => Promise.resolve(rows),
  getStats: () =>
    Promise.resolve({
      scheduled: 4,
      submissions: 98,
      submissionsExpected: 126,
      averageGrade: 87,
      awaitingReview: 6,
    }),
  listGradingBreakdown: () => Promise.resolve(gradingBreakdown),
};
