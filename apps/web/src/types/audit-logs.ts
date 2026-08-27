export type AuditLogResult = "success" | "failure";

export type AuditLogEntry = {
  ts: string;
  actor: string;
  action: string;
  target: string;
  ctx: string;
  ip: string;
  userAgent: string;
  organization: string;
  result: AuditLogResult;
};

export type AuditLogStats = {
  eventsLast24h: number;
  adminActions: number;
  gradingOverrides: number;
  retentionDays: number;
};

export type AuditLogCategory = { label: string; value: string; meter: number };
