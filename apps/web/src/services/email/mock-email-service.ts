import { useSoc } from "@/lib/store";
import type { EmailService } from "./email-service";

export const mockEmailService: EmailService = {
  getEmailCase: (caseId) => useSoc.getState().emailCases[caseId],
  submitEmailVerdict: (caseId, verdict, score) =>
    useSoc.getState().submitEmailVerdict(caseId, verdict, score),
  addEmailNote: (caseId, note) => useSoc.getState().addEmailNote(caseId, note),
};
