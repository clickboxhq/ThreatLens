import type { EmailInvestigationsService } from "./email-investigations-service";
import { mockEmailInvestigationsService } from "./mock-email-investigations-service";

export const emailInvestigationsService: EmailInvestigationsService =
  mockEmailInvestigationsService;
export type { EmailInvestigationsService } from "./email-investigations-service";
