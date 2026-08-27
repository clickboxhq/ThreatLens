import type { FeedbackService } from "./feedback-service";
import { mockFeedbackService } from "./mock-feedback-service";

export const feedbackService: FeedbackService = mockFeedbackService;
export type { FeedbackService } from "./feedback-service";
