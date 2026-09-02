import { Link } from "@tanstack/react-router";
import { IconTile } from "@/components/soc/ui/icon-tile";
import { ArrowLeft, ArrowRight, Clock3, FileText, Layers, ShieldAlert } from "lucide-react";
import type { SessionDto } from "@/types/socverse-investigation";

const DIFFICULTY_TONE: Record<string, string> = {
  beginner: "text-[color:var(--success)] border-[color:var(--success)]/30 bg-[color:var(--success)]/10",
  intermediate: "text-[color:var(--warning)] border-[color:var(--warning)]/30 bg-[color:var(--warning)]/10",
  advanced: "text-[color:var(--critical)] border-[color:var(--critical)]/30 bg-[color:var(--critical)]/10",
};

/**
 * The first thing an analyst sees when opening a case — read the incident before touching any
 * tool. Deliberately built only from the session's own public scenario fields (title, summary,
 * category, difficulty, duration) — the ground truth's narrative of what actually happened
 * never reaches the client, and nothing here is invented to look more complete than it is:
 * no fabricated severity or MITRE preview, since neither is real data at this point.
 */
export function ScenarioBriefing({
  session,
  onBegin,
}: {
  session: SessionDto;
  onBegin: () => void;
}) {
  const difficultyTone =
    DIFFICULTY_TONE[session.scenarioDifficulty.toLowerCase()] ??
    "text-secondary border-border bg-background";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-8">
      <Link
        to="/app/scenarios"
        className="mb-6 inline-flex items-center gap-1.5 text-[12px] text-secondary hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Scenario Library
      </Link>

      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Incident briefing
      </div>
      <h1 className="text-balance text-[24px] font-semibold leading-tight">
        {session.scenarioTitle}
      </h1>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11.5px]">
        <span className="rounded-md border border-border bg-card px-2 py-1 capitalize text-secondary">
          {session.scenarioCategory}
        </span>
        <span className={`rounded-md border px-2 py-1 capitalize ${difficultyTone}`}>
          {session.scenarioDifficulty}
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-secondary">
          <Clock3 className="size-3" /> ~{session.estimatedMinutes} min
        </span>
      </div>

      <div className="glass-card mt-6 p-5">
        <div className="flex items-start gap-3">
          <IconTile tone="info" size="md">
            <FileText className="size-4" />
          </IconTile>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              What's happened so far
            </div>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-secondary">
              {session.scenarioSummary}
            </p>
          </div>
        </div>
      </div>

      <div className="glass-card mt-4 p-5">
        <div className="flex items-start gap-3">
          <IconTile tone="warning" size="md">
            <ShieldAlert className="size-4" />
          </IconTile>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Your objective
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-secondary">
              Work the telemetry, pin what actually proves your conclusion, and take any
              containment the evidence calls for. You'll research indicators, document your
              reasoning, and close with a verdict you can defend — evidence precision and
              technique accuracy are both scored, so noise costs you as much as a missed signal.
            </p>
          </div>
        </div>
      </div>

      <div className="glass-card mt-4 p-5">
        <div className="flex items-start gap-3">
          <IconTile size="md">
            <Layers className="size-4" />
          </IconTile>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              How this investigation is structured
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-secondary">
              You'll move through this incident one stage at a time — investigate the telemetry,
              build your evidence, take response action if warranted, research indicators,
              document what you found, then review and submit a verdict. You can move back and
              forth between stages freely until you submit; nothing here is a timed quiz.
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={onBegin}
        className="btn-app-primary mt-6 h-11 w-full justify-center text-[13.5px]"
      >
        Begin Investigation <ArrowRight className="size-4" />
      </button>
    </div>
  );
}
