import type { FeedbackService } from "./feedback-service";

const feedback = [
  {
    inv: "INV-3181",
    title: "Business Email Compromise",
    from: "Jonas Weber · SOC Manager",
    when: "18m ago",
    grade: 94,
    body: "Strong scoping. You identified the inbox rule before the supplier message went out, which is the pivot that matters. Next time attach the raw message trace rather than the summary view — graders need the header chain.",
  },
  {
    inv: "INV-3182",
    title: "Impossible Travel Investigation",
    from: "Priya Nair · Incident Responder",
    when: "2h ago",
    grade: 81,
    body: "Correct verdict, but the conditional-access evaluation was skipped. An MFA-satisfied sign-in from an unfamiliar ASN is not benign on its own; check the policy that allowed it before closing.",
  },
  {
    inv: "INV-3177",
    title: "Data Exfiltration to Cloud Account",
    from: "Marcus Chen · Threat Hunter",
    when: "yesterday",
    grade: 88,
    body: "Good use of the cloud audit trail. Your ATT&CK mapping listed T1537 but omitted the collection step that preceded it — map the full chain, not just the terminal technique.",
  },
];

export const mockFeedbackService: FeedbackService = {
  listFeedback: () => Promise.resolve(feedback),
};
