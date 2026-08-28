import { Link } from "@tanstack/react-router";
import { Radar } from "lucide-react";

/** Alerts and the identity/device/email portals only have anything to show once a scenario's
 * telemetry exists — this is what a student sees before launching (or after submitting) their
 * only investigation, rather than a table that's silently empty. */
export function NoActiveSession({ title }: { title: string }) {
  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <div className="glass-card flex flex-col items-center gap-3 px-6 py-16 text-center">
        <Radar className="size-8 text-muted-foreground" />
        <h2 className="text-lg font-semibold">No active investigation</h2>
        <p className="max-w-sm text-sm text-secondary">
          {title} shows the telemetry for whichever investigation you're currently working. Launch a
          scenario to see it populate.
        </p>
        <Link
          to="/app/scenarios"
          className="mt-2 inline-flex h-9 items-center rounded-md bg-primary px-4 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover"
        >
          Browse scenarios
        </Link>
      </div>
    </div>
  );
}
