export type NotificationCategory =
  | "assignment"
  | "new-scenario"
  | "deadline"
  | "score-available"
  | "instructor-feedback"
  | "cohort-announcement"
  | "org-invitation"
  | "certificate-issued"
  | "billing"
  | "security";

export type Notification = {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  ts: string;
  read: boolean;
  href?: string;
};
