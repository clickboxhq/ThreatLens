import { createFileRoute, useParams } from "@tanstack/react-router";
import { DeviceDetailDrawer } from "@/components/soc/device-detail-drawer";

export const Route = createFileRoute("/app/endpoints/$sessionId/$deviceId")({
  component: EndpointWorkspacePage,
  head: () => ({ meta: [{ title: "ThreatLens · Endpoint Investigation" }] }),
});

/** The centralized Endpoint investigation workspace — see app.identity.$sessionId.$identityId.tsx
 * for why this reuses DeviceDetailDrawer's `variant="page"` instead of a second copy of the
 * process-tree/file/network/web investigation content. */
function EndpointWorkspacePage() {
  const { sessionId, deviceId } = useParams({ from: "/app/endpoints/$sessionId/$deviceId" });
  return (
    <DeviceDetailDrawer
      sessionId={sessionId}
      deviceId={deviceId}
      variant="page"
      backTo="/app/endpoints"
      backLabel="Back to Endpoint Center"
    />
  );
}
