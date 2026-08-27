import type { EmailCaseState, EmailVerdict } from "@/types/email";
import type { Note } from "@/types/common";

/**
 * Parity service for the store's emailCases slice. Nothing in the UI wires
 * this up yet (app.email.tsx uses its own display-only inline mock), but
 * the contract exists so a future "email case" investigation flow has a
 * service boundary ready rather than reaching into the store directly.
 */
export interface EmailService {
  getEmailCase(caseId: string): EmailCaseState | undefined;
  submitEmailVerdict(caseId: string, verdict: EmailVerdict, score: number): void;
  addEmailNote(caseId: string, note: Omit<Note, "id" | "ts">): void;
}
