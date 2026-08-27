import type { EmailMessageSummary } from "@/types/email-investigations";

export interface EmailInvestigationsService {
  listMessages(): Promise<EmailMessageSummary[]>;
}
