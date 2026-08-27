import type { EmailInvestigationsService } from "./email-investigations-service";

const messages = [
  {
    id: "MSG-3121",
    from: "billing@adobe-secure-invoice.com",
    subj: "Adobe subscription — action required",
    to: "sarah.chen@contoso.com",
    sev: "high" as const,
    when: "08:03",
  },
  {
    id: "MSG-3120",
    from: "hr-benefits@contoso-portal.net",
    subj: "Open enrollment: verify your details",
    to: "all-staff@contoso.com",
    sev: "critical" as const,
    when: "07:41",
  },
  {
    id: "MSG-3119",
    from: "no-reply@microsoft.com",
    subj: "Your recent sign-in — Zürich, CH",
    to: "kate.morgan@contoso.com",
    sev: "low" as const,
    when: "07:12",
  },
  {
    id: "MSG-3118",
    from: "wire-transfers@bank-of-westhaven.com",
    subj: "Wire release confirmation #4429",
    to: "ap@contoso.com",
    sev: "medium" as const,
    when: "06:58",
  },
];

export const mockEmailInvestigationsService: EmailInvestigationsService = {
  listMessages: () => Promise.resolve(messages),
};
