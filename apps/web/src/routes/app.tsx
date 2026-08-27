import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/soc/app-shell";

export const Route = createFileRoute("/app")({
  component: () => <AppShell />,
  head: () => ({
    meta: [{ title: "ThreatLens · Console" }],
  }),
});
