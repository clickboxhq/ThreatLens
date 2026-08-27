import type { InstructorFeedbackEntry } from "@/types/feedback";

export interface FeedbackService {
  listFeedback(): Promise<InstructorFeedbackEntry[]>;
}
