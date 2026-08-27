import type { ReportsService } from "./reports-service";

const reports = [
  {
    name: "Executive weekly — SOC posture",
    type: "Executive",
    updated: "Today, 07:00",
    format: "PDF",
  },
  { name: "Analyst performance — Q2", type: "Analyst", updated: "Yesterday", format: "Excel" },
  { name: "MITRE coverage delta", type: "Program", updated: "2 days ago", format: "PDF" },
  {
    name: "Incident retrospective — INC-4820",
    type: "Incident",
    updated: "3 days ago",
    format: "PDF",
  },
  {
    name: "Learning analytics — Cohort 12",
    type: "Learning",
    updated: "1 week ago",
    format: "CSV",
  },
];

export const mockReportsService: ReportsService = {
  listReports: () => Promise.resolve(reports),
};
