import { NotConnectedError } from "@/services/shared/not-connected-error";
import type { FeedbackService } from "./feedback-service";

export const apiFeedbackService: FeedbackService = {
  listFeedback: () => {
    throw new NotConnectedError("FeedbackService.listFeedback");
  },
};
