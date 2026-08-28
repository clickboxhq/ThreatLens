import type { EmailMessageDto } from "@/types/socverse-operations";

/** Emails are generated per session, same as identities/devices — see socverse-operations.ts. */
export interface EmailInvestigationsService {
  list(sessionId: string): Promise<EmailMessageDto[]>;
  getMessage(sessionId: string, messageId: string): Promise<EmailMessageDto>;
}
