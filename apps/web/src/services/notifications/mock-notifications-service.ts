import type { Notification } from "@/types/notifications";
import type { NotificationsService } from "./notifications-service";

let notifications: Notification[] = [
  {
    id: "NTF-1001",
    category: "score-available",
    title: "Investigation scored",
    body: "INC-4819 · Credential access — password spray campaign scored 70/100.",
    ts: "12m ago",
    read: false,
    href: "/app/cases/INC-4819",
  },
  {
    id: "NTF-1002",
    category: "instructor-feedback",
    title: "Feedback from Jonas Weber",
    body: "New feedback on your Business Email Compromise investigation.",
    ts: "18m ago",
    read: false,
    href: "/app/feedback",
  },
  {
    id: "NTF-1003",
    category: "assignment",
    title: "New assignment: Tier 1 Certification",
    body: "Identity Attacks practical assigned to your cohort, due Aug 22.",
    ts: "1h ago",
    read: false,
    href: "/app/assessments",
  },
  {
    id: "NTF-1004",
    category: "certificate-issued",
    title: "Certificate issued",
    body: "ThreatLens Certified Analyst — L2 is ready to download.",
    ts: "yesterday",
    read: true,
    href: "/app/certificates",
  },
  {
    id: "NTF-1005",
    category: "cohort-announcement",
    title: "Cohort announcement",
    body: "Autumn 2026 · Tier 1 Onboarding: new scenario library update available.",
    ts: "2 days ago",
    read: true,
    href: "/app/scenarios",
  },
  {
    id: "NTF-1006",
    category: "billing",
    title: "Invoice available",
    body: "Your August invoice ($18,432.00) is ready.",
    ts: "3 days ago",
    read: true,
    href: "/app/billing",
  },
];

export const mockNotificationsService: NotificationsService = {
  listNotifications: () => Promise.resolve(notifications),
  markAsRead: (id) => {
    notifications = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    return Promise.resolve();
  },
  markAllAsRead: () => {
    notifications = notifications.map((n) => ({ ...n, read: true }));
    return Promise.resolve();
  },
};
