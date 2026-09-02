/**
 * Central query-key factory for every react-query-backed ("Group B",
 * read-only) domain hook. Keeping these in one place means a future
 * mutation/invalidation can target a domain's key without hunting
 * through hook files for string literals.
 */
export const queryKeys = {
  organizations: ["organizations"] as const,
  leaderboard: ["leaderboard"] as const,
  dashboardPerformance: ["dashboard-performance"] as const,
  learningCenter: ["learning-center"] as const,
  mitreExplorer: ["mitre-explorer"] as const,
  analytics: ["analytics"] as const,
  achievements: ["achievements"] as const,
  certificates: ["certificates"] as const,
  auditLogs: ["audit-logs"] as const,
  billing: ["billing"] as const,
  cohorts: ["cohorts"] as const,
  feedback: ["feedback"] as const,
  instructor: ["instructor"] as const,
  assessments: ["assessments"] as const,
  profile: ["profile"] as const,
  reports: ["reports"] as const,
  scenarioBuilder: ["scenario-builder"] as const,
  search: ["search"] as const,
  settings: ["settings"] as const,
  studentAnalytics: ["student-analytics"] as const,
  threatIntel: ["threat-intel"] as const,
  evidenceLocker: ["evidence-locker"] as const,
  timeline: ["timeline"] as const,
  emailInvestigations: ["email-investigations"] as const,
  notifications: ["notifications"] as const,
};
