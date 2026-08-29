// Derived client-side from real sessions/skill-radar data (see api-analytics-service.ts) —
// there is no single "analytics" endpoint, and no real "target" or "MTTD" concept exists for a
// self-paced training session, so those ThreatLens-original fields are dropped rather than
// invented.
export type InvestigationActivityPoint = { m: string; started: number; completed: number };
export type TimeToResolutionPoint = { m: string; minutes: number };
