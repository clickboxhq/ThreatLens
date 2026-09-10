// Mirror of the backend `NotificationCategory` enum
// (apps/api/prisma/schema.prisma). Every value the API can emit MUST appear
// here and in notification-panel.tsx's icon map — an unmapped category renders
// `undefined` as a component and crashes the whole panel. Keep this list and
// the enum in lockstep.
export type NotificationCategory =
  | "assignment"
  | "score_available"
  | "instructor_feedback"
  | "certificate_issued"
  | "org_invitation"
  | "cohort_invitation";

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
