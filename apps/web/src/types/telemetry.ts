export type EntityType = "identity" | "device" | "mailbox" | "cloud";
export type TelemetrySeverity = "critical" | "high" | "medium" | "low" | "info";

export type SecurityEvent = {
  id: string;
  ts: string; // ISO
  source: string;
  action: string;
  detail: string;
  entity: string;
  entityType: EntityType;
  mitre?: string;
  severity: TelemetrySeverity;
  correlationId?: string;
};

export type MitreTechnique = { id: string; name: string; tactic: string };

export type ResponseAction = { id: string; label: string; target: string };

export type ThreatIndicator = {
  value: string;
  type: "sha256" | "ip" | "domain" | "url";
  reputation: "malicious" | "suspicious" | "unknown" | "known-good";
  actor?: string;
  campaign?: string;
  firstSeen: string;
  context: string;
  /** decoys are benign lookalikes seeded so keyword matching alone does not solve a scenario */
  decoy?: boolean;
};
