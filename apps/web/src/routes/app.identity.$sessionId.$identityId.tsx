import { createFileRoute, useParams } from "@tanstack/react-router";
import { IdentityDetailDrawer } from "@/components/soc/identity-detail-drawer";

export const Route = createFileRoute("/app/identity/$sessionId/$identityId")({
  component: IdentityWorkspacePage,
  head: () => ({ meta: [{ title: "ThreatLens · Identity Investigation" }] }),
});

/**
 * The centralized Identity investigation workspace — full page, not a
 * narrow side drawer. Reuses IdentityDetailDrawer's `variant="page"` so the
 * same tab content (profile, sign-ins, audit log, cloud activity) backs
 * both this page and the quick-preview drawer still used for in-case
 * pivoting, rather than maintaining two copies of the investigation logic.
 */
function IdentityWorkspacePage() {
  const { sessionId, identityId } = useParams({ from: "/app/identity/$sessionId/$identityId" });
  return (
    <IdentityDetailDrawer
      sessionId={sessionId}
      identityId={identityId}
      variant="page"
      backTo="/app/identity"
      backLabel="Back to Identity Center"
    />
  );
}
