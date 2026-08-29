import { createFileRoute } from "@tanstack/react-router";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { IconTile } from "@/components/soc/ui/icon-tile";
import { useProfile } from "@/hooks/use-profile";
import { Award } from "lucide-react";

export const Route = createFileRoute("/app/profile")({
  component: ProfilePage,
  head: () => ({ meta: [{ title: "ThreatLens · Profile" }] }),
});

function ProfilePage() {
  const { summary, skillMastery, certificates } = useProfile();
  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Profile"
        description="Your analyst identity, performance, and preferences."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-1">
          <div className="flex items-center gap-3">
            <IconTile tone="info" size="xl" shape="circle" className="text-[16px] font-semibold">
              {summary?.initials}
            </IconTile>
            <div>
              <div className="text-[15px] font-semibold">{summary?.name}</div>
              <div className="text-[11.5px] text-muted-foreground">{summary?.title}</div>
              <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                {summary?.email}
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              ["Score", summary?.score],
              ["Solved", summary?.solved],
              ["Rank", summary?.rank],
            ].map(([l, v]) => (
              <div key={l} className="rounded-md border border-border bg-background/40 p-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {l}
                </div>
                <div className="mt-0.5 text-[14px] font-semibold">{v}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="lg:col-span-2" title="Skills mastery" padded={false}>
          <div className="p-4">
            {skillMastery.length === 0 && (
              <p className="py-2 text-[12px] text-muted-foreground">
                Complete and score an investigation in each category to see your mastery here.
              </p>
            )}
            {skillMastery.map((s) => (
              <div key={s.label} className="mb-3">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-secondary">{s.label}</span>
                  <span className="tabular-nums text-secondary">{s.value}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-background">
                  <div
                    className="h-full rounded-full bg-[color:var(--info)]"
                    style={{ width: `${s.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-border p-4">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Certificates
            </div>
            {certificates.length === 0 && (
              <p className="py-1 text-[12px] text-muted-foreground">
                Complete a learning path to earn your first certificate.
              </p>
            )}
            {certificates.map((c) => (
              <div key={c.id} className="flex items-center gap-2 py-1 text-[12.5px]">
                <Award className="size-3.5 text-[color:var(--info)]" />
                {c.learningPathTitle}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
