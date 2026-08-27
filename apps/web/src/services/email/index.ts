import type { EmailService } from "./email-service";
import { mockEmailService } from "./mock-email-service";

export const emailService: EmailService = mockEmailService;
export type { EmailService } from "./email-service";
