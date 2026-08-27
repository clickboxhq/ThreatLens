import { UserRound, Cpu, Mail, FileText, Globe, Hash, Radar } from "lucide-react";
import type { SearchService } from "./search-service";

const categories = [
  { label: "Users", icon: UserRound, count: 12 },
  { label: "Devices", icon: Cpu, count: 4 },
  { label: "Alerts", icon: Radar, count: 22 },
  { label: "Emails", icon: Mail, count: 7 },
  { label: "Files", icon: FileText, count: 5 },
  { label: "Domains", icon: Globe, count: 3 },
  { label: "MITRE IDs", icon: Hash, count: 6 },
];

const topResults = [
  {
    icon: Radar,
    title: "Adversary · Storm-1811",
    meta: "Financially motivated · 14 tracked campaigns",
  },
  {
    icon: FileText,
    title: "SC-081 · BEC via OAuth consent phishing",
    meta: "Scenario · Advanced · 45 min",
  },
  {
    icon: Mail,
    title: "MSG-3120 · HR-benefits open enrollment phish",
    meta: "Correlated with Storm-1811-C · 87 messages",
  },
  {
    icon: UserRound,
    title: "sarah.chen@contoso.com",
    meta: "Identity · risk 47 · OAuth consent grant flagged",
  },
  { icon: Cpu, title: "SRV-DB-07", meta: "Windows Server 2022 · encoded PowerShell observed" },
];

export const mockSearchService: SearchService = {
  listCategories: () => Promise.resolve(categories),
  listTopResults: () => Promise.resolve(topResults),
};
