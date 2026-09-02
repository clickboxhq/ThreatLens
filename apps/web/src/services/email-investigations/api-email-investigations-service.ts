import { apiClient } from "@/lib/api-client";
import type { EmailInvestigationsService } from "./email-investigations-service";
import type { EmailMessageDto, EmailLinkActivityDto } from "@/types/threatlens-operations";
import type { EntityInsightDto } from "@/types/threatlens-operations";

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

  getInsights: (sessionId, messageId) =>
    apiClient.get<EntityInsightDto[]>(`/sessions/${sessionId}/emails/${messageId}/insights`),
};
