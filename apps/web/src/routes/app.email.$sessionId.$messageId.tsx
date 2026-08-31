import { createFileRoute, useParams } from "@tanstack/react-router";
import { EmailDetailDrawer } from "@/components/soc/email-detail-drawer";

export const Route = createFileRoute("/app/email/$sessionId/$messageId")({
  component: EmailWorkspacePage,
  head: () => ({ meta: [{ title: "ThreatLens · Email Investigation" }] }),
});

/** The centralized Email investigation workspace — full page, including the real header
 * forensics analyzer (EmailHeaderAnalysis) that was previously only reachable via the case
 * workspace's pivot drawer, never from the Email Investigations list page itself. */
function EmailWorkspacePage() {
  const { sessionId, messageId } = useParams({ from: "/app/email/$sessionId/$messageId" });
  return (
    <EmailDetailDrawer
      sessionId={sessionId}
      emailId={messageId}
      variant="page"
      backTo="/app/email"
      backLabel="Back to Email Investigation"
    />
  );
}
