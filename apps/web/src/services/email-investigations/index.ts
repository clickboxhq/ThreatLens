import { apiEmailInvestigationsService } from "./api-email-investigations-service";
import type { EmailInvestigationsService } from "./email-investigations-service";

export const emailInvestigationsService: EmailInvestigationsService = apiEmailInvestigationsService;

export type { EmailInvestigationsService } from "./email-investigations-service";
