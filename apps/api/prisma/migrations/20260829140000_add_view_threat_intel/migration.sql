-- Backs a Student's own real "Threat Intelligence" history: recorded only when a lookup
-- against GET /sessions/:id/threat-intel actually matches a real indicator, so this never
-- becomes a way to enumerate a scenario's full indicator set (its ground truth) — only what
-- the Student themselves already looked up and found.
ALTER TYPE "InvestigationActionType" ADD VALUE 'view_threat_intel';
