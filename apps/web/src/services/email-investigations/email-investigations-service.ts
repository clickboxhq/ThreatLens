import type { EmailMessageDto, EmailLinkActivityDto } from "@/types/socverse-operations";

/** Emails are generated per session, same as identities/devices — see socverse-operations.ts. */
export interface EmailInvestigationsService {
  list(sessionId: string): Promise<EmailMessageDto[]>;
  getMessage(sessionId: string, messageId: string): Promise<EmailMessageDto>;
  /** Same sender domain, elsewhere in this session — "who else got this?" */
  getSimilar(sessionId: string, messageId: string): Promise<EmailMessageDto[]>;
  /** Per-URL click correlation against the session's HTTP telemetry — "did anyone click it?" */
  getLinkActivity(sessionId: string, messageId: string): Promise<EmailLinkActivityDto[]>;
}
