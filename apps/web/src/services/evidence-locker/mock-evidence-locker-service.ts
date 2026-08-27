import type { EvidenceLockerService } from "./evidence-locker-service";

const artifacts = [
  {
    id: "EVD-9014",
    name: "message_trace_INV-3181.csv",
    type: "Message trace",
    inv: "INV-3181",
    sev: "critical" as const,
    hash: "9f2c…41ab",
    who: "J. Doe",
    when: "12m ago",
  },
  {
    id: "EVD-9013",
    name: "signin_logs_kate.morgan.json",
    type: "Identity log",
    inv: "INV-3182",
    sev: "high" as const,
    hash: "4de1…0c77",
    who: "J. Doe",
    when: "38m ago",
  },
  {
    id: "EVD-9012",
    name: "proc_tree_SRV-DB-07.txt",
    type: "Process tree",
    inv: "INV-3178",
    sev: "critical" as const,
    hash: "b710…9e12",
    who: "P. Nair",
    when: "1h ago",
  },
  {
    id: "EVD-9011",
    name: "invoice_update.docm",
    type: "Attachment",
    inv: "INV-3181",
    sev: "high" as const,
    hash: "cc09…7a54",
    who: "A. Ward",
    when: "2h ago",
  },
  {
    id: "EVD-9010",
    name: "oauth_consent_grant.json",
    type: "Cloud audit",
    inv: "INV-3179",
    sev: "medium" as const,
    hash: "1a88…33f0",
    who: "J. Doe",
    when: "3h ago",
  },
  {
    id: "EVD-9009",
    name: "usb_insert_events.evtx",
    type: "Endpoint log",
    inv: "INV-3177",
    sev: "medium" as const,
    hash: "77bd…5cd1",
    who: "Y. Demir",
    when: "yesterday",
  },
];

const coverageBySource = [
  { label: "Identity", value: "96%", meter: 96 },
  { label: "Endpoint", value: "88%", meter: 88 },
  { label: "Email", value: "93%", meter: 93 },
  { label: "Cloud", value: "84%", meter: 84 },
  { label: "Network", value: "71%", meter: 71 },
];

const gradingImpact = [
  { label: "Evidence weight", value: "40% of score" },
  { label: "Correct conclusion", value: "35% of score" },
  { label: "ATT&CK mapping", value: "15% of score" },
  { label: "Time to resolution", value: "10% of score" },
];

export const mockEvidenceLockerService: EvidenceLockerService = {
  listArtifacts: () => Promise.resolve(artifacts),
  getStats: () =>
    Promise.resolve({
      artifactsCollected: 214,
      collectionRate: 91,
      requiredOutstanding: 6,
      chainOfCustody: 100,
    }),
  listCoverageBySource: () => Promise.resolve(coverageBySource),
  listGradingImpact: () => Promise.resolve(gradingImpact),
};
