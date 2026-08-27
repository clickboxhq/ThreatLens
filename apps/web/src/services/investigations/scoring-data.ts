// Hidden ground truth (§12.3) — never rendered to a student before submission.
//
// SECURITY BOUNDARY: this module must never be re-exported from any public
// barrel (no `index.ts` re-export). Only scoring.ts may import it. A real
// backend must keep this server-side entirely — moving it here only draws
// the architectural line; it does not hide the bytes from this client
// bundle, which is unavoidable without a real server boundary.
import type { GroundTruth } from "@/types/scoring";

export const groundTruth: Record<string, GroundTruth> = {
  "INC-4821": {
    incidentId: "INC-4821",
    scenarioId: "SC-081",
    verdict: "true-positive",
    techniques: ["T1566.002", "T1528", "T1078", "T1098.002", "T1114.002", "T1537"],
    evidenceIds: ["EV-1001", "EV-1003", "EV-1004", "EV-1005", "EV-1006", "EV-1007", "EV-1014"],
    noiseIds: ["EV-1002", "EV-1016", "EV-1018", "EV-1015"],
    requiredActions: ["revoke-tokens", "disable-account", "block-sender"],
    narrative:
      "Storm-1811 delivered an OAuth consent lure to sarah.chen@contoso.com. After consent, the actor replayed the refresh token from Lagos, created a hiding inbox rule, enumerated 1,284 messages via Graph, and exfiltrated 3.4 GB from the finance SharePoint site. Password-spray and USB activity in the same window are unrelated noise.",
    minEvidence: 5,
  },
  "INC-4820": {
    incidentId: "INC-4820",
    scenarioId: "SC-080",
    verdict: "true-positive",
    techniques: ["T1105", "T1059.001", "T1021.002", "T1486"],
    evidenceIds: ["EV-1009", "EV-1010", "EV-1011", "EV-1012", "EV-1013"],
    noiseIds: ["EV-1017", "EV-1015", "EV-1002"],
    requiredActions: ["isolate-device", "block-ip"],
    narrative:
      "A macro-borne certutil download staged svc.dll on FIN-DESK-22, loaded it via encoded PowerShell, and established a 60s-jitter beacon to 41.203.18.77. The actor moved laterally to SRV-DB-07 over ADMIN$ using svc-backup and persisted with a scheduled task — a pre-ransomware staging pattern.",
    minEvidence: 4,
  },
  "INC-4819": {
    incidentId: "INC-4819",
    scenarioId: "SC-079",
    verdict: "true-positive",
    techniques: ["T1110.003", "T1078"],
    evidenceIds: ["EV-1008"],
    noiseIds: ["EV-1016", "EV-1018"],
    requiredActions: ["force-password-reset"],
    narrative:
      "A distributed password spray from a Tor exit node succeeded against two low-privilege accounts that were exempt from the tenant MFA policy.",
    minEvidence: 1,
  },
  "INC-4818": {
    incidentId: "INC-4818",
    scenarioId: "SC-078",
    verdict: "true-positive",
    techniques: ["T1537", "T1114.002"],
    evidenceIds: ["EV-1007", "EV-1014"],
    noiseIds: ["EV-1018", "EV-1002"],
    requiredActions: ["revoke-tokens"],
    narrative:
      "Delegated Graph access was used to bulk-read mail and pull 3.4 GB from the finance SharePoint site.",
    minEvidence: 2,
  },
  "INC-4817": {
    incidentId: "INC-4817",
    scenarioId: "SC-081",
    verdict: "benign-positive",
    techniques: ["T1566.002"],
    evidenceIds: ["EV-1001"],
    noiseIds: ["EV-1002", "EV-1018"],
    requiredActions: ["block-sender"],
    narrative:
      "The consent lure was delivered but the recipient never opened it and no consent was granted. Real malicious mail, no impact — a benign positive, not a false positive.",
    minEvidence: 1,
  },
};
