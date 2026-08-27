import type { Note } from "./common";

export type EmailVerdict = "phishing" | "benign" | "suspicious";

export type EmailCaseState = {
  verdict?: EmailVerdict;
  notes: Note[];
  submittedAt?: string;
  score?: number;
};
