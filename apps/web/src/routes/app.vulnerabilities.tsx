import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Panel, SectionHeader, SeverityBadge } from "@/components/soc/primitives";
import { NoActiveSession } from "@/components/soc/no-active-session";
import { SessionPicker } from "@/components/soc/session-picker";
import { Skeleton, EmptyState } from "@/components/soc/ui/skeleton";
import { useActiveSession } from "@/hooks/use-active-session";
import { useUpdateVulnerabilityStatus, useVulnerabilities } from "@/hooks/use-vulnerabilities";
import { AlertTriangle, Check, Globe, Loader2, ShieldCheck, ShieldOff, X } from "lucide-react";
import type { VulnerabilityDto, VulnerabilityStatus } from "@/types/socverse-operations";

export const Route = createFileRoute("/app/vulnerabilities")({
  component: VulnerabilityManagement,
  head: () => ({ meta: [{ title: "ThreatLens · Vulnerability Management" }] }),
});

const STATUS_COPY: Record<VulnerabilityStatus, string> = {
  open: "Open",
  remediated: "Remediated",
  accepted_risk: "Risk accepted",
  false_positive: "False positive",
};

const STATUS_TONE: Record<VulnerabilityStatus, string> = {
  open: "text-[color:var(--critical)]",
  remediated: "text-[color:var(--success)]",
  accepted_risk: "text-[color:var(--warning)]",
  false_positive: "text-muted-foreground",
};

const EXPLOITABILITY_COPY: Record<VulnerabilityDto["exploitability"], string> = {
  no_known_exploit: "No known exploit",
  proof_of_concept: "Public PoC exists",
  actively_exploited: "Actively exploited",
};

function VulnerabilityManagement() {
  const { isLoading: sessionsLoading, activeSessions, selectedSessionId, setSelectedSessionId } =
    useActiveSession();

  if (sessionsLoading) {
    return (
      <div className="px-4 py-6 md:px-8 md:py-8">
        <SectionHeader title="Vulnerability Management" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (!selectedSessionId) {
    return <NoActiveSession title="Vulnerability Management" />;
  }

  return (
    <VulnManagementInner
      sessionId={selectedSessionId}
      activeSessions={activeSessions}
      selectedSessionId={selectedSessionId}
      setSelectedSessionId={setSelectedSessionId}
    />
  );
}

function VulnManagementInner({
  sessionId,
  activeSessions,
  selectedSessionId,
  setSelectedSessionId,
}: {
  sessionId: string;
  activeSessions: ReturnType<typeof useActiveSession>["activeSessions"];
  selectedSessionId: string | undefined;
  setSelectedSessionId: (id: string) => void;
}) {
  const { data: findings, isPending } = useVulnerabilities(sessionId);
  const updateStatus = useUpdateVulnerabilityStatus(sessionId);

  const [severityFilter, setSeverityFilter] = useState<VulnerabilityDto["severity"] | "all">("all");
  const [statusFilter, setStatusFilter] = useState<VulnerabilityStatus | "all">("all");
  const [exposureOnly, setExposureOnly] = useState(false);

  const all = findings ?? [];
  const visible = all.filter((v) => {
    if (severityFilter !== "all" && v.severity !== severityFilter) return false;
    if (statusFilter !== "all" && v.status !== statusFilter) return false;
    if (exposureOnly && v.exposure !== "internet_facing") return false;
    return true;
  });

  const open = all.filter((v) => v.status === "open");
  const criticalOpen = open.filter((v) => v.severity === "critical").length;
  const priorityCount = open.filter(
    (v) => v.exposure === "internet_facing" && v.exploitability === "actively_exploited",
  ).length;
  const avgCvss = all.length > 0 ? all.reduce((sum, v) => sum + v.cvssScore, 0) / all.length : 0;

  const setStatus = (v: VulnerabilityDto, status: VulnerabilityStatus) => {
    updateStatus.mutate(
      { vulnerabilityId: v.id, status },
      {
        onSuccess: () => toast.success(`${v.cve} marked ${STATUS_COPY[status].toLowerCase()}.`),
        onError: () => toast.error(`Couldn't update ${v.cve} — try again.`),
      },
    );
  };

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Vulnerability Management"
        description="Findings for this investigation's environment, prioritized by exposure and exploitability — not just CVSS score."
        actions={
          <SessionPicker
            sessions={activeSessions}
            selectedId={selectedSessionId}
            onChange={setSelectedSessionId}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Panel>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Findings</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{all.length}</div>
        </Panel>
        <Panel>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Open</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-[color:var(--critical)]">
            {open.length}
          </div>
        </Panel>
        <Panel>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Critical &amp; open
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-[color:var(--critical)]">
            {criticalOpen}
          </div>
        </Panel>
        <Panel>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Avg. CVSS</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{avgCvss.toFixed(1)}</div>
        </Panel>
      </div>

      {priorityCount > 0 && (
        <div className="mt-4 flex items-start gap-2.5 rounded-md border border-[color:var(--critical)]/30 bg-[color:var(--critical)]/10 px-3 py-2.5 text-[12px] text-[color:var(--critical)]">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {priorityCount} open finding{priorityCount === 1 ? " is" : "s are"} both internet-facing
            and actively exploited in the wild — these are the ones to triage first, regardless of
            CVSS score alone.
          </span>
        </div>
      )}

      <div className="mb-3 mt-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-md border border-border bg-background p-0.5">
          {(["all", "critical", "high", "medium", "low"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSeverityFilter(s)}
              className={`rounded px-2 py-1 text-[11px] capitalize transition-colors ${
                severityFilter === s
                  ? "bg-[color:var(--info)]/15 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as VulnerabilityStatus | "all")}
          className="h-8 rounded-md border border-border bg-background px-2 text-[11.5px] outline-none"
        >
          <option value="all">All statuses</option>
          {(Object.keys(STATUS_COPY) as VulnerabilityStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_COPY[s]}
            </option>
          ))}
        </select>
        <button
          onClick={() => setExposureOnly((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11.5px] transition-colors ${
            exposureOnly
              ? "border-[color:var(--info)]/50 bg-[color:var(--info)]/10 text-foreground"
              : "border-border bg-background text-secondary hover:text-foreground"
          }`}
        >
          <Globe className="size-3.5" /> Internet-facing only
        </button>
      </div>

      <Panel padded={false}>
        {isPending ? (
          <div className="flex flex-col gap-px p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="size-6" />}
            title="No matching findings"
            description="Adjust the filters, or nothing was found for this investigation's environment."
          />
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((v) => (
              <li key={v.id} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[12px] font-medium">{v.cve}</span>
                      <SeverityBadge level={v.severity} />
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        CVSS {v.cvssScore.toFixed(1)}
                      </span>
                      {v.exploitability === "actively_exploited" && (
                        <span className="rounded-md bg-[color:var(--critical)]/10 px-1.5 py-0.5 text-[10px] text-[color:var(--critical)] ring-1 ring-inset ring-[color:var(--critical)]/25">
                          Actively exploited
                        </span>
                      )}
                      {v.exposure === "internet_facing" && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          <Globe className="size-2.5" /> Internet-facing
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[12.5px]">{v.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span className="font-mono">{v.affectedAsset}</span>
                      <span>{EXPLOITABILITY_COPY[v.exploitability]}</span>
                      <span className={`font-medium ${STATUS_TONE[v.status]}`}>
                        {STATUS_COPY[v.status]}
                        {v.statusNote ? ` — ${v.statusNote}` : ""}
                      </span>
                    </div>
                    <p className="mt-1.5 max-w-2xl text-[11px] leading-relaxed text-secondary">
                      {v.remediation}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {updateStatus.isPending &&
                    updateStatus.variables?.vulnerabilityId === v.id ? (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    ) : v.status === "open" ? (
                      <>
                        <button
                          onClick={() => setStatus(v, "remediated")}
                          className="inline-flex items-center gap-1 rounded-md border border-[color:var(--success)]/30 bg-[color:var(--success)]/10 px-2 py-1 text-[11px] text-[color:var(--success)] hover:bg-[color:var(--success)]/20"
                        >
                          <Check className="size-3" /> Remediate
                        </button>
                        <button
                          onClick={() => setStatus(v, "accepted_risk")}
                          className="rounded-md border border-border px-2 py-1 text-[11px] text-secondary hover:text-foreground"
                        >
                          Accept risk
                        </button>
                        <button
                          onClick={() => setStatus(v, "false_positive")}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-secondary hover:text-foreground"
                        >
                          <X className="size-3" /> False positive
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setStatus(v, "open")}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-secondary hover:text-foreground"
                      >
                        <ShieldOff className="size-3" /> Reopen
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
