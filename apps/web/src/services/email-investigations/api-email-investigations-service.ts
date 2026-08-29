import { apiClient } from "@/lib/api-client";
import type { EmailInvestigationsService } from "./email-investigations-service";
import type { EmailMessageDto, EmailLinkActivityDto } from "@/types/socverse-operations";

export const apiEmailInvestigationsService: EmailInvestigationsService = {
  list: (sessionId) => apiClient.get<EmailMessageDto[]>(`/sessions/${sessionId}/emails`),

  getMessage: (sessionId, messageId) =>
    apiClient.get<EmailMessageDto>(`/sessions/${sessionId}/emails/${messageId}`),

  getSimilar: (sessionId, messageId) =>
    apiClient.get<EmailMessageDto[]>(`/sessions/${sessionId}/emails/${messageId}/similar`),

  getLinkActivity: (sessionId, messageId) =>
    apiClient.get<EmailLinkActivityDto[]>(
      `/sessions/${sessionId}/emails/${messageId}/link-activity`,
    ),
};
