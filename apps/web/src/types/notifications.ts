// Matches SOCVerse's real notifications API (apps/api/src/modules/notifications) — net new in
// Phase 6 of the merge plan. Only categories with a real backend trigger exist here —
// deliberately excludes ThreatLens's original mock categories with no backing event yet
// (new-scenario, deadline, cohort-announcement, billing, security).
export type NotificationCategory =
  | "assignment"
  | "score_available"
  | "instructor_feedback"
  | "certificate_issued"
  | "org_invitation"
  // Added alongside SOC Career Progression — see career-progression.service.ts.
  | "career_milestone";

export type Notification = {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  /** Same-origin app path, e.g. "/app/cases/<sessionId>" — never an absolute URL. */
  link: string | null;
  read: boolean;
  createdAt: string;
};
