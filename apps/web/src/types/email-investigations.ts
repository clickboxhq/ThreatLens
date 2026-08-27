import type { Severity } from "./common";

export type EmailMessageSummary = {
  id: string;
  from: string;
  subj: string;
  to: string;
  sev: Severity;
  when: string;
};
