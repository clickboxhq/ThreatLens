import type { CohortsService } from "./cohorts-service";

const cohorts = [
  {
    id: "CH-2026-A",
    name: "Autumn 2026 · Tier 1 Onboarding",
    learners: 42,
    track: "SOC Analyst",
    progress: 68,
    avg: 84,
    instructor: "Jonas Weber",
  },
  {
    id: "CH-2026-B",
    name: "Autumn 2026 · Threat Hunting",
    learners: 24,
    track: "Threat Hunter",
    progress: 41,
    avg: 79,
    instructor: "Marcus Chen",
  },
  {
    id: "CH-2026-C",
    name: "Contoso Internal · IR Rotation",
    learners: 18,
    track: "Incident Responder",
    progress: 88,
    avg: 91,
    instructor: "Priya Nair",
  },
  {
    id: "CH-2026-D",
    name: "MSSP Partner Program",
    learners: 44,
    track: "SOC Analyst",
    progress: 55,
    avg: 76,
    instructor: "Elena Rossi",
  },
];

const trackCompletion = [
  { label: "SOC Analyst", value: "62%", meter: 62 },
  { label: "Threat Hunter", value: "41%", meter: 41 },
  { label: "Incident Responder", value: "88%", meter: 88 },
];

export const mockCohortsService: CohortsService = {
  listCohorts: () => Promise.resolve(cohorts),
  getStats: () =>
    Promise.resolve({
      activeCohorts: 4,
      enrolledAnalysts: 128,
      averageScore: 82,
      atRiskLearners: 7,
    }),
  listTrackCompletion: () => Promise.resolve(trackCompletion),
};
