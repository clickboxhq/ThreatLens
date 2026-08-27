import { NotConnectedError } from "@/services/shared/not-connected-error";
import type { EmailService } from "./email-service";

const notConnected = (method: string): never => {
  throw new NotConnectedError(`EmailService.${method}`);
};

export const apiEmailService: EmailService = {
  getEmailCase: () => notConnected("getEmailCase"),
  submitEmailVerdict: () => notConnected("submitEmailVerdict"),
  addEmailNote: () => notConnected("addEmailNote"),
};
