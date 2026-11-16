import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import {
  listRealScenarios,
  type RealScenario,
} from "@/services/scenario-catalog/scenario-catalog-service";
import { useLaunchScenario } from "@/hooks/use-investigations";
import { useMySessions } from "@/hooks/use-sessions";
import { ApiError } from "@/lib/api-client";
import { Clock, Loader2, PlayCircle, Sparkles, Trophy } from "lucide-react";

type ScenarioLibSearch = { slug?: string };

export const Route = createFileRoute("/app/scenarios")({
  component: ScenarioLib,
  validateSearch: (search: Record<string, unknown>): ScenarioLibSearch => ({
    slug: typeof search.slug === "string" ? search.slug : undefined,
  }),
  head: () => ({ meta: [{ title: "ThreatLens · Scenario Library" }] }),
});

// The eight categories the catalogue actually spans (ScenarioCategory in the API's schema), in
// the order a learner would meet them — not alphabetical, and not the four the old description
// named.
const CATEGORY_LABEL: Record<string, string> = {
  identity: "Identity",
  email: "Email",
  endpoint: "Endpoint",
  cloud: "Cloud",
  web: "Web",
  malware: "Malware",
  ransomware: "Ransomware",
  insider_threat: "Insider threat",
};
const CATEGORIES = Object.keys(CATEGORY_LABEL);
const DIFFICULTIES = ["beginner", "intermediate", "advanced", "expert"] as const;
const DIFFICULTY_RANK: Record<string, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
  expert: 3,
};

type Sort = "recommended" | "shortest" | "longest" | "title";
const SORT_LABEL: Record<Sort, string> = {
  recommended: "Recommended order",
  shortest: "Shortest first",
  longest: "Longest first",
  title: "A to Z",
};

const DIFFICULTY_TONE: Record<string, string> = {
  beginner: "text-[color:var(--success)]",
  intermediate: "text-[color:var(--warning)]",
  advanced: "text-[color:var(--critical)]",
  expert: "text-[color:var(--critical)]",
};

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`transition-app rounded-full border px-3 py-1 text-[11.5px] ${
        active
          ? "border-[color:var(--info)]/50 bg-[color:var(--info)]/12 text-[color:var(--info)]"
          : "border-border text-secondary hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function ScenarioLib() {
  const navigate = useNavigate();
  const { slug: highlightSlug } = Route.useSearch();
  const { data: scenarios, isPending } = useQuery({
    queryKey: ["scenarios"],
    queryFn: listRealScenarios,
  });
  const { data: sessions, isPending: sessionsPending } = useMySessions();
  const launch = useLaunchScenario();
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState<string>("all");
  const [difficulty, setDifficulty] = useState<string>("all");
  const [onlyUnattempted, setOnlyUnattempted] = useState(false);
  const [sort, setSort] = useState<Sort>("recommended");

  // A command-palette pick or any other deep link lands on the library scrolled to (and
  // briefly highlighting) the actual scenario, instead of a bare navigate to the top of a
  // list the Student then has to search again by eye.
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  useEffect(() => {
    if (!highlightSlug) return;
    const el = cardRefs.current.get(highlightSlug);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightSlug, scenarios]);

  // What the learner has already done with each scenario, from their own session history —
  // so a card can say "best 74%, 2 attempts" instead of every card looking untouched.
  const stats = useMemo(() => {
    const byScenario = new Map<string, { attempts: number; best: number | null }>();
    for (const s of sessions ?? []) {
      const cur = byScenario.get(s.scenarioId) ?? { attempts: 0, best: null };
      cur.attempts += 1;
      if (s.overallPercent != null) {
        cur.best = cur.best == null ? s.overallPercent : Math.max(cur.best, s.overallPercent);
      }
      byScenario.set(s.scenarioId, cur);
    }
    return byScenario;
  }, [sessions]);
  const hasScoredAnything = (sessions ?? []).some((s) => s.status === "scored");

  const visible = useMemo(() => {
    const list = (scenarios ?? []).filter(
      (s) =>
        (category === "all" || s.category === category) &&
        (difficulty === "all" || s.difficulty === difficulty) &&
        (!onlyUnattempted || !stats.has(s.id)),
    );
    const byTitle = (a: RealScenario, b: RealScenario) => a.title.localeCompare(b.title);
    switch (sort) {
      case "shortest":
        return list.sort((a, b) => a.estimatedMinutes - b.estimatedMinutes || byTitle(a, b));
      case "longest":
        return list.sort((a, b) => b.estimatedMinutes - a.estimatedMinutes || byTitle(a, b));
      case "title":
        return list.sort(byTitle);
      default:
        // Easiest first, then shortest — the order you would hand them to someone new.
        return list.sort(
          (a, b) =>
            (DIFFICULTY_RANK[a.difficulty] ?? 9) - (DIFFICULTY_RANK[b.difficulty] ?? 9) ||
            a.estimatedMinutes - b.estimatedMinutes ||
            byTitle(a, b),
        );
    }
  }, [scenarios, category, difficulty, onlyUnattempted, sort, stats]);

  async function handleLaunch(scenarioId: string) {
    setError(null);
    setLaunchingId(scenarioId);
    try {
      const { sessionId } = await launch.mutateAsync(scenarioId);
      navigate({ to: "/app/cases/$id", params: { id: sessionId } });
    } catch (err) {
      setLaunchingId(null);
      if (err instanceof ApiError && err.code === "EMAIL_VERIFICATION_REQUIRED") {
        setError(
          "Verify your email address before starting a scenario — check the banner at the top of the page.",
        );
      } else {
        setError(err instanceof ApiError ? err.message : "Could not start this scenario.");
      }
    }
  }

  const total = scenarios?.length ?? 0;

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Scenario Library"
        description="Published investigations across identity, email, endpoint, cloud, web, malware, ransomware and insider threat."
      />

      {error && (
        <p className="mb-4 rounded-md border border-[color:var(--critical)]/40 bg-[color:var(--critical)]/10 p-3 text-[12.5px]">
          {error}
        </p>
      )}

      {!sessionsPending && !hasScoredAnything && difficulty !== "beginner" && (
        <div className="glass-card mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-[color:var(--info)]" />
            <div>
              <div className="text-[13px] font-medium">New here? Start with a beginner case.</div>
              <p className="mt-0.5 text-[12px] text-secondary">
                Short chains, less noise, and the signal is findable once you look in the right
                place. The advanced ones assume you have done a few of these.
              </p>
            </div>
          </div>
          <button onClick={() => setDifficulty("beginner")} className="btn-app-primary h-9">
            Show beginner cases
          </button>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <Chip active={category === "all"} onClick={() => setCategory("all")}>
          All categories
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
            {CATEGORY_LABEL[c]}
          </Chip>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <Chip active={difficulty === "all"} onClick={() => setDifficulty("all")}>
          Any difficulty
        </Chip>
        {DIFFICULTIES.map((d) => (
          <Chip key={d} active={difficulty === d} onClick={() => setDifficulty(d)}>
            <span className="capitalize">{d}</span>
          </Chip>
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        <Chip active={onlyUnattempted} onClick={() => setOnlyUnattempted((v) => !v)}>
          Not yet attempted
        </Chip>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="ml-auto h-8 rounded-md border border-border bg-card px-2 text-[11.5px] text-secondary outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Sort scenarios"
        >
          {(Object.keys(SORT_LABEL) as Sort[]).map((k) => (
            <option key={k} value={k}>
              {SORT_LABEL[k]}
            </option>
          ))}
        </select>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {visible.length} of {total}
        </span>
      </div>

      {isPending ? (
        <p className="text-[12.5px] text-secondary">Loading scenarios…</p>
      ) : total === 0 ? (
        <p className="text-[12.5px] text-secondary">No published scenarios yet.</p>
      ) : visible.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-[12.5px] text-muted-foreground">
          Nothing matches those filters.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((s) => {
            const stat = stats.get(s.id);
            return (
              <div
                key={s.id}
                ref={(el) => {
                  if (el) cardRefs.current.set(s.slug, el);
                  else cardRefs.current.delete(s.slug);
                }}
                className={
                  highlightSlug === s.slug
                    ? "rounded-xl ring-2 ring-[color:var(--info)] ring-offset-2 ring-offset-background transition-shadow"
                    : undefined
                }
              >
                <Panel className="flex h-full flex-col">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="rounded border border-border bg-background px-1.5 py-0.5">
                      {CATEGORY_LABEL[s.category] ?? s.category}
                    </span>
                    <span className={`capitalize ${DIFFICULTY_TONE[s.difficulty] ?? ""}`}>
                      {s.difficulty}
                    </span>
                  </div>
                  <h3 className="mt-2 text-[14.5px] font-medium leading-snug">{s.title}</h3>
                  <p className="mt-1.5 line-clamp-3 text-[12px] text-secondary">{s.summary}</p>
                  <div className="mt-auto flex items-center justify-between pt-4 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" /> ~{s.estimatedMinutes} min
                    </span>
                    {stat ? (
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        {stat.best != null && (
                          <>
                            <Trophy className="size-3 text-[color:var(--success)]" />
                            best {Math.round(stat.best)}% ·{" "}
                          </>
                        )}
                        {stat.attempts} {stat.attempts === 1 ? "attempt" : "attempts"}
                      </span>
                    ) : (
                      <span>Not yet attempted</span>
                    )}
                  </div>
                  <button
                    disabled={launchingId === s.id}
                    onClick={() => handleLaunch(s.id)}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
                  >
                    {launchingId === s.id ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Starting…
                      </>
                    ) : (
                      <>
                        <PlayCircle className="size-4" />{" "}
                        {stat ? "Try again" : "Launch investigation"}
                      </>
                    )}
                  </button>
                </Panel>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
