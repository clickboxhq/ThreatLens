import { Cloud, HardDrive, Mail, Network, UserRound } from "lucide-react";
import type { ScenarioBuilderService } from "./scenario-builder-service";

const eventSources = [
  { icon: UserRound, label: "Identity events", count: 14 },
  { icon: HardDrive, label: "Endpoint events", count: 22 },
  { icon: Mail, label: "Email events", count: 9 },
  { icon: Cloud, label: "Cloud events", count: 11 },
  { icon: Network, label: "Network events", count: 7 },
];

const timeline = [
  {
    t: "T+00:00",
    src: "Email",
    detail: "Spearphishing link delivered to finance@contoso.com",
    mitre: "T1566.002",
    sev: "medium" as const,
  },
  {
    t: "T+00:06",
    src: "Identity",
    detail: "Sign-in from unfamiliar ASN, MFA satisfied",
    mitre: "T1078",
    sev: "high" as const,
  },
  {
    t: "T+00:11",
    src: "Cloud",
    detail: "Inbox rule created — forward to external address",
    mitre: "T1098.002",
    sev: "high" as const,
  },
  {
    t: "T+00:34",
    src: "Email",
    detail: "Payment redirection message sent to supplier",
    mitre: "T1114.002",
    sev: "critical" as const,
  },
];

const config = [
  { k: "Hidden ground truth", v: "BEC via inbox rule" },
  { k: "Randomization", v: "Users, hosts, timestamps" },
  { k: "Automated grading", v: "Enabled · 9 artifacts" },
  { k: "Hints", v: "3 · score penalty 5% each" },
  { k: "Time limit", v: "60 minutes" },
];

const validation = [
  "Ground truth reachable from injected evidence",
  "All 4 required ATT&CK mappings present",
  "Network events missing for lateral phase",
];

export const mockScenarioBuilderService: ScenarioBuilderService = {
  listEventSources: () => Promise.resolve(eventSources),
  listDraftTimeline: () => Promise.resolve(timeline),
  listConfig: () => Promise.resolve(config),
  listValidationMessages: () => Promise.resolve(validation),
};
