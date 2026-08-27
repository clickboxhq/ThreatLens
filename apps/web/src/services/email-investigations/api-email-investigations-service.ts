import { NotConnectedError } from "@/services/shared/not-connected-error";
import type { EmailInvestigationsService } from "./email-investigations-service";

export const apiEmailInvestigationsService: EmailInvestigationsService = {
  listMessages: () => {
    throw new NotConnectedError("EmailInvestigationsService.listMessages");
  },
};
