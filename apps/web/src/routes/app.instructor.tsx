import { createFileRoute } from "@tanstack/react-router";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { IconTile } from "@/components/soc/ui/icon-tile";
import { useInstructor } from "@/hooks/use-instructor";
import { GraduationCap, Users } from "lucide-react";

export const Route = createFileRoute("/app/instructor")({
  component: InstructorPortal,
  head: () => ({ meta: [{ title: "ThreatLens · Instructor Portal" }] }),
});

function InstructorPortal() {
  const { cohorts } = useInstructor();
  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Instructor Portal"
        description="Cohorts, assignments, and mastery-based grading for training providers."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {cohorts.map((c) => (
          <Panel key={c.name}>
            <div className="flex items-start gap-3">
              <IconTile tone="info" size="lg">
                <GraduationCap className="size-5" />
              </IconTile>
              <div className="flex-1">
                <h3 className="text-[14.5px] font-semibold">{c.name}</h3>
                <div className="mt-1 flex items-center gap-4 text-[11.5px] text-secondary">
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3.5 text-muted-foreground" /> {c.learners} learners
                  </span>
                  <span>
                    Avg. score <span className="text-foreground">{c.avg}</span>
                  </span>
                  <span>{c.active} active investigations</span>
                </div>
              </div>
              <button className="rounded-md border border-border px-2 py-1 text-[11px] text-secondary">
                Open
              </button>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
