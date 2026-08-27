/**
 * ThreatLens product demonstrations.
 *
 * Four native surfaces — Command Center, Investigation Workspace, Threat
 * Correlation Practice, Progress Dashboard — rendered as real, interactive
 * software rather than screenshots. Monochrome graphite with red reserved for
 * risk, threat and criticality only. Every surface depicts the analyst doing
 * the work — nothing here investigates or concludes on its own.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Cloud,
  Fingerprint,
  Gauge,
  HardDrive,
  Mail,
  Network,
  NotebookPen,
  Search,
  Shuffle,
  ShieldAlert,
  Siren,
  Timer,
} from "lucide-react";

import { Reveal, displayFont, monoFont } from "./atmos";
import { AppWindow, DemoIntro, DemoSection, Pill } from "./chrome";
import { Glow } from "./art";

/* ------------------------------------------------------------------ */
/*  shared hooks                                                       */
/* ------------------------------------------------------------------ */

/** Runs a callback on an interval only while the element is on screen. */
function useOnScreen<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => setSeen(e.isIntersecting)), {
      threshold: 0.15,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, seen };
}

function useTick(active: boolean, ms: number, max: number) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setI((v) => (v + 1) % max), ms);
    return () => clearInterval(id);
  }, [active, ms, max]);
  return i;
}

/* ------------------------------------------------------------------ */
/*  DEMO 01 — SECURITY COMMAND CENTER                                  */
/* ------------------------------------------------------------------ */

const NAV = [
  { icon: Gauge, l: "Overview" },
  { icon: Siren, l: "Alerts" },
  { icon: ShieldAlert, l: "Incidents" },
  { icon: Fingerprint, l: "Identity" },
  { icon: HardDrive, l: "Endpoints" },
  { icon: Mail, l: "Email" },
  { icon: Cloud, l: "Cloud" },
  { icon: Search, l: "Search" },
];

type Alert = {
  id: string;
  sev: "critical" | "warn" | "ok";
  title: string;
  entity: string;
  src: string;
  age: string;
  conf: number;
};

const ALERTS: Alert[] = [
  {
    id: "ALR-9F31",
    sev: "critical",
    title: "Impossible travel + MFA fatigue",
    entity: "sarah.chen@contoso.com",
    src: "Entra ID",
    age: "2m",
    conf: 96,
  },
  {
    id: "ALR-9F28",
    sev: "critical",
    title: "Credential access via LSASS read",
    entity: "SRV-DB-07",
    src: "EDR",
    age: "6m",
    conf: 93,
  },
  {
    id: "ALR-9F24",
    sev: "warn",
    title: "OAuth consent to unverified app",
    entity: "sarah.chen@contoso.com",
    src: "Email",
    age: "14m",
    conf: 88,
  },
  {
    id: "ALR-9F19",
    sev: "warn",
    title: "S3 bucket policy widened",
    entity: "prod-artifacts",
    src: "AWS",
    age: "21m",
    conf: 74,
  },
  {
    id: "ALR-9F11",
    sev: "ok",
    title: "Beaconing to low-reputation ASN",
    entity: "WS-4412",
    src: "Network",
    age: "38m",
    conf: 61,
  },
];

function CommandCenter() {
  const { ref, seen } = useOnScreen<HTMLDivElement>();
  const [sel, setSel] = useState(0);
  const [queue, setQueue] = useState(1284);
  const auto = useTick(seen, 3200, ALERTS.length);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!touched) setSel(auto);
  }, [auto, touched]);

  useEffect(() => {
    if (!seen) return;
    const id = setInterval(() => setQueue((q) => q + Math.floor(Math.random() * 7) + 1), 1600);
    return () => clearInterval(id);
  }, [seen]);

  const a = ALERTS[sel];

  return (
    <div ref={ref}>
      <AppWindow path="threatlensapp.com / console">
        <div className="grid grid-cols-1 lg:grid-cols-[188px_minmax(0,1fr)]">
          {/* sidebar */}
          <div className="hidden border-r border-white/8 bg-black/40 p-3 lg:block">
            <div
              className="px-2 pb-3 text-[9.5px] uppercase tracking-[0.22em] text-white/30"
              style={monoFont}
            >
              Operations
            </div>
            {NAV.map((n, i) => (
              <div
                key={n.l}
                className="flex items-center gap-2.5 rounded-md px-2 py-[7px] text-[12.5px] transition-colors"
                style={{
                  color: i === 1 ? "#fff" : "rgba(255,255,255,0.5)",
                  background: i === 1 ? "rgba(255,255,255,0.06)" : "transparent",
                }}
              >
                <n.icon className="size-[15px]" />
                {n.l}
                {i === 1 && (
                  <span
                    className="ml-auto rounded px-1 text-[9.5px]"
                    style={{
                      ...monoFont,
                      background: "color-mix(in oklab, var(--critical) 25%, transparent)",
                      color: "#FFD9DA",
                    }}
                  >
                    12
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* main */}
          <div className="min-w-0">
            {/* top bar */}
            <div className="flex items-center gap-3 border-b border-white/8 px-4 py-3">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-white/8 bg-black/50 px-2.5 py-1.5">
                <Search className="size-3.5 shrink-0 text-white/30" />
                <span className="truncate text-[12px] text-white/40" style={monoFont}>
                  entity:sarah.chen severity&gt;=high last:24h
                </span>
              </div>
              <div
                className="hidden shrink-0 items-center gap-1.5 text-[10.5px] text-white/40 sm:flex"
                style={monoFont}
              >
                <Activity className="size-3" />
                {queue.toLocaleString()} events/min
              </div>
            </div>

            {/* kpis */}
            <div className="grid grid-cols-2 gap-px border-b border-white/8 bg-white/[0.06] md:grid-cols-4">
              {[
                ["Open incidents", "7", "critical"],
                ["Alerts triaged (24h)", "1,942", ""],
                ["Cases closed (24h)", "34", ""],
                ["Median time to verdict", "11m", ""],
              ].map(([l, v, tone]) => (
                <div key={l} className="bg-[#0A0A0A] px-4 py-3.5">
                  <div
                    className="text-[9.5px] uppercase tracking-[0.18em] text-white/35"
                    style={monoFont}
                  >
                    {l}
                  </div>
                  <div
                    className="mt-1.5 text-[22px] font-semibold tracking-[-0.02em]"
                    style={{
                      ...displayFont,
                      color: tone ? "color-mix(in oklab, var(--critical) 85%, white)" : "#fff",
                    }}
                  >
                    {v}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
              {/* queue */}
              <div className="border-white/8 xl:border-r">
                {ALERTS.map((row, i) => {
                  const active = i === sel;
                  return (
                    <button
                      key={row.id}
                      onMouseEnter={() => {
                        setTouched(true);
                        setSel(i);
                      }}
                      onFocus={() => {
                        setTouched(true);
                        setSel(i);
                      }}
                      className="group flex w-full items-center gap-3 border-b border-white/[0.06] px-4 py-3 text-left transition-colors"
                      style={{
                        background: active ? "rgba(255,255,255,0.045)" : "transparent",
                      }}
                    >
                      <span
                        className="h-8 w-[2px] shrink-0 rounded transition-opacity"
                        style={{
                          background:
                            row.sev === "critical"
                              ? "var(--critical)"
                              : row.sev === "warn"
                                ? "var(--warning)"
                                : "rgba(255,255,255,0.25)",
                          opacity: active ? 1 : 0.45,
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-white/35" style={monoFont}>
                            {row.id}
                          </span>
                          <Pill tone={row.sev}>
                            {row.sev === "critical"
                              ? "critical"
                              : row.sev === "warn"
                                ? "high"
                                : "medium"}
                          </Pill>
                        </div>
                        <div className="mt-1 truncate text-[13px] font-medium text-white">
                          {row.title}
                        </div>
                        <div className="mt-0.5 truncate text-[11px] text-white/40" style={monoFont}>
                          {row.entity} · {row.src}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[11px] text-white/45" style={monoFont}>
                          {row.age}
                        </div>
                        <div className="mt-1.5 h-1 w-14 overflow-hidden rounded-full bg-white/8">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: active ? `${row.conf}%` : "0%",
                              background:
                                row.sev === "ok" ? "rgba(255,255,255,0.5)" : "var(--primary)",
                            }}
                          />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* alert detail */}
              <div className="bg-black/25 p-4">
                <div className="flex items-center gap-2">
                  <Search className="size-3.5" style={{ color: "var(--primary)" }} />
                  <span className="text-[12px] font-medium text-white">Linked evidence</span>
                  <span className="ml-auto text-[10px] text-white/35" style={monoFont}>
                    conf {a.conf}%
                  </span>
                </div>

                <div
                  key={a.id}
                  className="mt-3 animate-[fade-in_.35s_ease-out] rounded-lg border p-3.5"
                  style={{
                    borderColor: "rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  <div className="text-[13px] leading-[1.6] text-white/80">
                    <span className="text-white">{a.title}</span> on{" "}
                    <span style={monoFont} className="text-white">
                      {a.entity}
                    </span>
                    . 4 related signals across {a.src.toLowerCase()} and identity, within a 6-hour
                    window — worth pulling the thread on.
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {["T1078", "T1110.003", "T1213"].map((t) => (
                      <span
                        key={t}
                        className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-white/60"
                        style={monoFont}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div
                  className="mt-3 text-[9.5px] uppercase tracking-[0.18em] text-white/30"
                  style={monoFont}
                >
                  Suggested response
                </div>
                <div className="mt-1.5 space-y-1.5">
                  {[
                    ["Revoke active sessions", "identity"],
                    ["Quarantine host", "endpoint"],
                    ["Open incident + page on-call", "workflow"],
                  ].map(([l, m]) => (
                    <div
                      key={l}
                      className="flex cursor-default items-center gap-2 rounded-md border border-white/8 bg-white/[0.02] px-2.5 py-2 text-[12px] text-white/75 transition-colors hover:border-white/25 hover:text-white"
                    >
                      {l}
                      <span
                        className="ml-auto text-[9.5px] uppercase tracking-[0.16em] text-white/30"
                        style={monoFont}
                      >
                        {m}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppWindow>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DEMO 02 — INVESTIGATION WORKSPACE                                  */
/* ------------------------------------------------------------------ */

type Lane = "Identity" | "Endpoint" | "Email" | "Cloud";

const TIMELINE: {
  t: string;
  lane: Lane;
  title: string;
  detail: string;
  hot?: boolean;
}[] = [
  {
    t: "21:58",
    lane: "Email",
    title: "OAuth consent phish delivered",
    detail: "Sender ASN first-seen 6h ago · no DMARC alignment",
  },
  {
    t: "22:04",
    lane: "Email",
    title: "Consent granted to 'Contoso Reports'",
    detail: "Scopes: Mail.Read, offline_access",
  },
  {
    t: "22:11",
    lane: "Identity",
    title: "Refresh token minted",
    detail: "Client 4a1e… · IP 45.86.x.x (unfamiliar ASN)",
    hot: true,
  },
  {
    t: "01:47",
    lane: "Identity",
    title: "MFA fatigue — 14 pushes, 1 approval",
    detail: "sarah.chen@contoso.com",
  },
  {
    t: "02:14",
    lane: "Endpoint",
    title: "SSH to SRV-DB-07 accepted",
    detail: "Key auth · session 44m",
    hot: true,
  },
  {
    t: "02:19",
    lane: "Endpoint",
    title: "LSASS memory read",
    detail: "procdump-like behaviour, unsigned binary",
  },
  {
    t: "02:41",
    lane: "Cloud",
    title: "3 privileged queries on customers.pii",
    detail: "1.2M rows scanned · no export",
  },
  {
    t: "02:58",
    lane: "Cloud",
    title: "S3 policy widened on prod-artifacts",
    detail: "Principal: * (blocked by ThreatLens playbook)",
  },
];

const LANES: { k: Lane; icon: typeof Mail }[] = [
  { k: "Identity", icon: Fingerprint },
  { k: "Endpoint", icon: HardDrive },
  { k: "Email", icon: Mail },
  { k: "Cloud", icon: Cloud },
];

const EVIDENCE_PINNED = [
  { label: "OAuth consent phish delivered", tag: "T1566.002" },
  { label: "Refresh token minted from unfamiliar ASN", tag: "T1078" },
  { label: "MFA fatigue — 14 pushes, 1 approval", tag: "T1621" },
  { label: "SSH to SRV-DB-07 accepted", tag: "T1021.004" },
  { label: "LSASS memory read", tag: "T1003.001" },
];

function InvestigationWorkspace() {
  const { ref, seen } = useOnScreen<HTMLDivElement>();
  const [lane, setLane] = useState<Lane | "All">("All");
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!seen) return;
    setStep(0);
    const id = setInterval(() => setStep((s) => (s >= EVIDENCE_PINNED.length ? s : s + 1)), 900);
    return () => clearInterval(id);
  }, [seen]);

  const rows = useMemo(
    () => (lane === "All" ? TIMELINE : TIMELINE.filter((r) => r.lane === lane)),
    [lane],
  );

  return (
    <div ref={ref}>
      <AppWindow path="threatlensapp.com / investigations / INC-42188">
        <div className="flex flex-wrap items-center gap-3 border-b border-white/8 px-4 py-3">
          <div className="text-[11px] text-white/40" style={monoFont}>
            INC-42188
          </div>
          <div className="text-[13.5px] font-medium text-white">
            Consent phish → privileged data access
          </div>
          <Pill tone="critical">active</Pill>
          <div
            className="ml-auto flex items-center gap-1.5 text-[10.5px] text-white/40"
            style={monoFont}
          >
            <Timer className="size-3" /> opened 4h ago
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          {/* timeline */}
          <div className="border-white/8 lg:border-r">
            <div className="flex flex-wrap items-center gap-1.5 border-b border-white/8 px-4 py-2.5">
              {(["All", ...LANES.map((l) => l.k)] as (Lane | "All")[]).map((k) => {
                const active = lane === k;
                const Icon = LANES.find((l) => l.k === k)?.icon;
                return (
                  <button
                    key={k}
                    onClick={() => setLane(k)}
                    className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors"
                    style={{
                      color: active ? "#fff" : "rgba(255,255,255,0.45)",
                      background: active ? "rgba(255,255,255,0.08)" : "transparent",
                    }}
                  >
                    {Icon && <Icon className="size-3" />}
                    {k}
                  </button>
                );
              })}
            </div>

            <div className="relative max-h-[420px] overflow-hidden px-4 py-4">
              <div
                aria-hidden
                className="absolute bottom-6 left-[38px] top-6 w-px"
                style={{
                  background:
                    "linear-gradient(180deg, transparent, rgba(255,255,255,.2), transparent)",
                }}
              />
              <div className="space-y-3.5">
                {rows.map((r, i) => (
                  <div
                    key={r.t + r.title}
                    className="group relative flex animate-[fade-in_.4s_ease-out] gap-3"
                    style={{ animationDelay: `${i * 45}ms` }}
                  >
                    <div
                      className="w-[34px] shrink-0 pt-[2px] text-right text-[10.5px] text-white/35"
                      style={monoFont}
                    >
                      {r.t}
                    </div>
                    <span
                      className="relative z-10 mt-[6px] size-[7px] shrink-0 rounded-full ring-4 ring-[#0A0A0A]"
                      style={{
                        background: r.hot ? "var(--critical)" : "rgba(255,255,255,0.45)",
                      }}
                    />
                    <div className="min-w-0 flex-1 rounded-lg px-2.5 py-1.5 transition-colors group-hover:bg-white/[0.035]">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-[13px] font-medium text-white">{r.title}</div>
                        <span
                          className="ml-auto shrink-0 text-[9.5px] uppercase tracking-[0.16em] text-white/30"
                          style={monoFont}
                        >
                          {r.lane}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-[11.5px] text-white/45">{r.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-14"
                style={{
                  background: "linear-gradient(180deg, transparent, #080808)",
                }}
              />
            </div>
          </div>

          {/* your evidence & notes */}
          <div className="bg-black/25">
            <div className="flex items-center gap-2 border-b border-white/8 px-4 py-2.5">
              <CheckCircle2 className="size-3.5" style={{ color: "var(--primary)" }} />
              <span className="text-[12px] font-medium text-white">Evidence you've pinned</span>
            </div>
            <div className="space-y-2 p-4">
              {EVIDENCE_PINNED.map((item, i) => {
                const pinned = i < step;
                const now = i === step;
                return (
                  <div
                    key={item.label}
                    className="flex items-start gap-2.5 text-[12.5px] leading-[1.55] transition-all duration-500"
                    style={{
                      opacity: pinned ? 1 : now ? 0.85 : 0.22,
                      transform: pinned || now ? "none" : "translateY(3px)",
                    }}
                  >
                    <span
                      className="mt-[3px] flex size-3.5 shrink-0 items-center justify-center rounded-[3px] border"
                      style={{
                        borderColor: pinned ? "var(--primary)" : "rgba(255,255,255,0.25)",
                        background: pinned ? "var(--primary)" : "transparent",
                      }}
                    >
                      {pinned && <CheckCircle2 className="size-3 text-black" strokeWidth={3} />}
                    </span>
                    <span className={pinned ? "text-white/80" : "text-white/55"}>{item.label}</span>
                    <span className="ml-auto shrink-0 text-[9.5px] text-white/30" style={monoFont}>
                      {item.tag}
                    </span>
                  </div>
                );
              })}

              <div
                className="!mt-5 rounded-lg border p-3.5 transition-all duration-700"
                style={{
                  opacity: step >= EVIDENCE_PINNED.length ? 1 : 0,
                  transform: step >= EVIDENCE_PINNED.length ? "none" : "translateY(8px)",
                  borderColor: "rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <div
                  className="flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.2em] text-white/40"
                  style={monoFont}
                >
                  <NotebookPen className="size-3" />
                  Your case notes (example)
                </div>
                <p className="mt-2 text-[12.5px] leading-[1.6] text-white/85">
                  A consent-phish granted persistent mail access, which was used to socially
                  engineer an MFA approval and pivot to SRV-DB-07. Credential material was read from
                  memory before privileged queries hit customers.pii. No exfiltration observed — my
                  verdict below.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {["Revoke token", "Quarantine SRV-DB-07", "Export brief"].map((c) => (
                    <span
                      key={c}
                      className="rounded-md border border-white/12 bg-white/[0.04] px-2 py-1 text-[11px] text-white/80"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppWindow>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DEMO 03 — THREAT CORRELATION ENGINE                                */
/* ------------------------------------------------------------------ */

const CORR_NODES = [
  { id: "identity", l: "Identity", sub: "sarah.chen", x: 120, y: 90, icon: "IDN" },
  { id: "endpoint", l: "Endpoint", sub: "SRV-DB-07", x: 640, y: 90, icon: "EDR" },
  { id: "email", l: "Email", sub: "consent phish", x: 100, y: 400, icon: "MAIL" },
  { id: "cloud", l: "Cloud", sub: "customers.pii", x: 660, y: 400, icon: "CLD" },
  { id: "network", l: "Network", sub: "45.86.x.x", x: 390, y: 500, icon: "NET" },
];

const ATTACK_PATH = ["email", "identity", "endpoint", "cloud"];

function CorrelationEngine() {
  const { ref, seen } = useOnScreen<HTMLDivElement>();
  const [hover, setHover] = useState<string | null>(null);
  const pathIdx = useTick(seen && !hover, 1400, ATTACK_PATH.length + 1);
  const activeId = hover ?? ATTACK_PATH[pathIdx] ?? null;
  const cx = 390;
  const cy = 250;

  return (
    <div ref={ref} className="relative">
      <Glow className="-inset-x-24 -inset-y-24 rounded-full" intensity={0.14} />
      <AppWindow path="threatlensapp.com / correlation">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <div className="relative border-white/8 lg:border-r">
            <svg viewBox="0 0 780 580" className="h-full w-full">
              <defs>
                <radialGradient id="cb-core-g" cx="50%" cy="50%">
                  <stop
                    offset="0%"
                    stopColor="color-mix(in oklab, var(--primary) 55%, transparent)"
                  />
                  <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </radialGradient>
              </defs>

              {/* faint plate */}
              <g stroke="rgba(255,255,255,.05)" strokeWidth="1">
                {Array.from({ length: 12 }, (_, i) => (
                  <line key={`v${i}`} x1={i * 70} y1="0" x2={i * 70} y2="580" />
                ))}
                {Array.from({ length: 9 }, (_, i) => (
                  <line key={`h${i}`} x1="0" y1={i * 70} x2="780" y2={i * 70} />
                ))}
              </g>

              {/* spokes into the core */}
              {CORR_NODES.map((n) => {
                const on = activeId === n.id;
                return (
                  <g key={`e-${n.id}`}>
                    <path
                      d={`M ${n.x} ${n.y} Q ${(n.x + cx) / 2} ${(n.y + cy) / 2 + (n.y < cy ? -40 : 40)} ${cx} ${cy}`}
                      fill="none"
                      stroke={
                        on
                          ? "color-mix(in oklab, var(--primary) 90%, white)"
                          : "rgba(255,255,255,.18)"
                      }
                      strokeWidth={on ? 1.6 : 0.8}
                      strokeDasharray="3 7"
                      style={{ transition: "stroke .4s, stroke-width .4s" }}
                    >
                      <animate
                        attributeName="stroke-dashoffset"
                        values="0;-40"
                        dur="4s"
                        repeatCount="indefinite"
                      />
                    </path>
                  </g>
                );
              })}

              {/* attack path arcs */}
              {ATTACK_PATH.slice(0, -1).map((id, i) => {
                const a = CORR_NODES.find((n) => n.id === id)!;
                const b = CORR_NODES.find((n) => n.id === ATTACK_PATH[i + 1])!;
                const on = activeId === a.id || activeId === b.id;
                return (
                  <path
                    key={`p${i}`}
                    d={`M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`}
                    fill="none"
                    stroke={
                      on
                        ? "color-mix(in oklab, var(--critical) 85%, transparent)"
                        : "rgba(255,255,255,.1)"
                    }
                    strokeWidth={on ? 1.4 : 0.8}
                    style={{ transition: "stroke .4s, stroke-width .4s" }}
                  />
                );
              })}

              {/* core */}
              <circle cx={cx} cy={cy} r="115" fill="url(#cb-core-g)" opacity="0.55" />
              <circle cx={cx} cy={cy} r="78" fill="none" stroke="rgba(255,255,255,.1)" />
              <circle
                cx={cx}
                cy={cy}
                r="54"
                fill="none"
                stroke="color-mix(in oklab, var(--primary) 60%, transparent)"
                strokeWidth="1"
                strokeDasharray="4 9"
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from={`0 ${cx} ${cy}`}
                  to={`360 ${cx} ${cy}`}
                  dur="26s"
                  repeatCount="indefinite"
                />
              </circle>
              <circle
                cx={cx}
                cy={cy}
                r="34"
                fill="rgba(6,9,13,.9)"
                stroke="color-mix(in oklab, var(--primary) 85%, transparent)"
                strokeWidth="1.1"
              />
              <text
                x={cx}
                y={cy - 1}
                textAnchor="middle"
                fill="#fff"
                fontSize="9"
                letterSpacing="1.6"
                fontFamily='"Geist Mono", monospace'
              >
                CASE
              </text>
              <text
                x={cx}
                y={cy + 11}
                textAnchor="middle"
                fill="rgba(255,255,255,.5)"
                fontSize="7"
                letterSpacing="1.4"
                fontFamily='"Geist Mono", monospace'
              >
                GRAPH
              </text>

              {/* nodes */}
              {CORR_NODES.map((n) => {
                const on = activeId === n.id;
                return (
                  <g
                    key={n.id}
                    onMouseEnter={() => setHover(n.id)}
                    onMouseLeave={() => setHover(null)}
                    style={{ cursor: "pointer" }}
                  >
                    <rect
                      x={n.x - 72}
                      y={n.y - 26}
                      width="144"
                      height="52"
                      rx="9"
                      fill={on ? "rgba(20,25,32,.98)" : "rgba(9,12,16,.92)"}
                      stroke={
                        on
                          ? "color-mix(in oklab, var(--primary) 80%, transparent)"
                          : "rgba(255,255,255,.14)"
                      }
                      style={{ transition: "fill .3s, stroke .3s" }}
                    />
                    <text
                      x={n.x - 58}
                      y={n.y - 6}
                      fill="rgba(255,255,255,.35)"
                      fontSize="7.5"
                      letterSpacing="1.4"
                      fontFamily='"Geist Mono", monospace'
                    >
                      {n.icon}
                    </text>
                    <text
                      x={n.x - 58}
                      y={n.y + 7}
                      fill="#fff"
                      fontSize="12"
                      fontWeight="600"
                      fontFamily="Geist, Inter, sans-serif"
                    >
                      {n.l}
                    </text>
                    <text
                      x={n.x - 58}
                      y={n.y + 19}
                      fill="rgba(255,255,255,.45)"
                      fontSize="8.5"
                      fontFamily='"Geist Mono", monospace'
                    >
                      {n.sub}
                    </text>
                    {on && (
                      <circle cx={n.x + 60} cy={n.y - 12} r="3" fill="var(--critical)">
                        <animate
                          attributeName="opacity"
                          values="1;.25;1"
                          dur="1.6s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* correlation readout */}
          <div className="bg-black/25 p-5">
            <div
              className="text-[9.5px] uppercase tracking-[0.22em] text-white/35"
              style={monoFont}
            >
              Attack path
            </div>
            <div className="mt-3 space-y-1.5">
              {ATTACK_PATH.map((id, i) => {
                const n = CORR_NODES.find((x) => x.id === id)!;
                const on = activeId === id;
                return (
                  <div
                    key={id}
                    onMouseEnter={() => setHover(id)}
                    onMouseLeave={() => setHover(null)}
                    className="flex cursor-default items-center gap-2.5 rounded-md border px-2.5 py-2 transition-all duration-300"
                    style={{
                      borderColor: on
                        ? "color-mix(in oklab, var(--primary) 55%, transparent)"
                        : "rgba(255,255,255,0.07)",
                      background: on
                        ? "color-mix(in oklab, var(--primary) 9%, transparent)"
                        : "rgba(255,255,255,0.015)",
                    }}
                  >
                    <span className="text-[10px] text-white/35" style={monoFont}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[12.5px] font-medium text-white">{n.l}</span>
                    <span className="ml-auto truncate text-[10.5px] text-white/40" style={monoFont}>
                      {n.sub}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-white/[0.07]">
              {[
                ["Signals joined", "37"],
                ["Sources", "5"],
                ["Deduplicated", "94%"],
                ["Time to graph", "1.8s"],
              ].map(([l, v]) => (
                <div key={l} className="bg-[#0A0A0A] px-3 py-2.5">
                  <div
                    className="text-[9px] uppercase tracking-[0.16em] text-white/35"
                    style={monoFont}
                  >
                    {l}
                  </div>
                  <div className="mt-1 text-[17px] font-semibold text-white" style={displayFont}>
                    {v}
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-5 text-[12.5px] leading-[1.65] text-white/50">
              Every edge reflects a real shared attribute — identity, device, session, network — not
              something wired by hand. Reading the graph, and deciding what's worth chasing, is
              yours.
            </p>
          </div>
        </div>
      </AppWindow>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DEMO 04 — EXECUTIVE SECURITY DASHBOARD                             */
/* ------------------------------------------------------------------ */

const SCORE_SERIES = [52, 58, 61, 67, 65, 71, 76, 79, 81, 84, 86, 91];

function Ring({ value, seen }: { value: number; seen: boolean }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 140 140" className="size-[132px]">
      <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="8" />
      <circle
        cx="70"
        cy="70"
        r={r}
        fill="none"
        stroke="url(#ring-g)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={seen ? c - (c * value) / 100 : c}
        transform="rotate(-90 70 70)"
        style={{ transition: "stroke-dashoffset 1.6s cubic-bezier(.22,1,.36,1)" }}
      />
      <defs>
        <linearGradient id="ring-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,.9)" />
          <stop offset="100%" stopColor="color-mix(in oklab, var(--primary) 95%, white)" />
        </linearGradient>
      </defs>
      <text
        x="70"
        y="72"
        textAnchor="middle"
        fill="#fff"
        fontSize="30"
        fontWeight="600"
        fontFamily="Geist, Inter, sans-serif"
      >
        {value}
      </text>
      <text
        x="70"
        y="90"
        textAnchor="middle"
        fill="rgba(255,255,255,.4)"
        fontSize="8.5"
        letterSpacing="1.6"
        fontFamily='"Geist Mono", monospace'
      >
        SCORE
      </text>
    </svg>
  );
}

function ExecutiveDashboard() {
  const { ref, seen } = useOnScreen<HTMLDivElement>();
  const max = Math.max(...SCORE_SERIES);

  return (
    <div ref={ref}>
      <AppWindow path="threatlensapp.com / progress" live={false}>
        <div className="flex items-center gap-3 border-b border-white/8 px-4 py-3">
          <div className="text-[13.5px] font-medium text-white">
            Your progress — 12 cases completed
          </div>
          <span className="ml-auto text-[10.5px] text-white/35" style={monoFont}>
            updated after every submitted case
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          <div className="flex flex-col items-center justify-center gap-4 border-white/8 px-6 py-8 lg:border-r">
            <Ring value={87} seen={seen} />
            <div className="text-center">
              <div className="text-[12.5px] text-white/60">Up 23 points since your first case</div>
              <div
                className="mt-1 text-[10.5px] uppercase tracking-[0.18em] text-white/30"
                style={monoFont}
              >
                vs. cohort median 61
              </div>
            </div>
          </div>

          <div>
            <div className="grid grid-cols-2 gap-px bg-white/[0.06] md:grid-cols-3">
              {[
                ["Avg. case score", "87", "+23 pts"],
                ["Technique accuracy", "91%", "+34 pts"],
                ["Evidence precision", "88%", "+19 pts"],
                ["Cases completed", "12", "this month"],
                ["Verdict accuracy", "92%", "+11 pts"],
                ["Median time / case", "34m", "−41%"],
              ].map(([l, v, d]) => (
                <div key={l} className="bg-[#0A0A0A] px-4 py-3.5">
                  <div
                    className="text-[9.5px] uppercase tracking-[0.16em] text-white/35"
                    style={monoFont}
                  >
                    {l}
                  </div>
                  <div
                    className="mt-1.5 text-[21px] font-semibold tracking-[-0.02em] text-white"
                    style={displayFont}
                  >
                    {v}
                  </div>
                  <div
                    className="mt-0.5 text-[10.5px]"
                    style={{
                      ...monoFont,
                      color: "color-mix(in oklab, var(--primary) 85%, white)",
                    }}
                  >
                    {d}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-white/8 p-5">
              <div className="flex items-baseline justify-between">
                <div
                  className="text-[9.5px] uppercase tracking-[0.2em] text-white/35"
                  style={monoFont}
                >
                  Score trend — last 12 cases
                </div>
                <div className="text-[10.5px] text-white/35" style={monoFont}>
                  score / 100
                </div>
              </div>
              <div className="mt-4 flex h-[112px] items-end gap-[6px]">
                {SCORE_SERIES.map((v, i) => (
                  <div key={i} className="group flex-1">
                    <div
                      className="w-full rounded-t-[3px] transition-all duration-700"
                      style={{
                        height: seen ? `${(v / max) * 104}px` : "2px",
                        transitionDelay: `${i * 55}ms`,
                        background:
                          i >= SCORE_SERIES.length - 4
                            ? "linear-gradient(180deg, color-mix(in oklab, var(--primary) 90%, white), color-mix(in oklab, var(--primary) 35%, transparent))"
                            : "rgba(255,255,255,0.14)",
                      }}
                    />
                  </div>
                ))}
              </div>
              <div
                className="mt-2 flex justify-between text-[9.5px] text-white/25"
                style={monoFont}
              >
                <span>Case 1</span>
                <span>Case 12</span>
              </div>
            </div>
          </div>
        </div>
      </AppWindow>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PUBLIC SECTION WRAPPERS                                            */
/* ------------------------------------------------------------------ */

export { CommandCenter, InvestigationWorkspace, CorrelationEngine, ExecutiveDashboard };

/** Small hero-adjacent proof strip. */
export function ProofStrip() {
  const items = [
    { icon: Network, l: "4 signal domains, one console" },
    { icon: Shuffle, l: "A fresh scenario every session" },
    { icon: Timer, l: "Graded against a hidden ground truth" },
    { icon: ShieldAlert, l: "MITRE ATT&CK mapped by default" },
  ];
  return (
    <div className="mx-auto mt-16 grid max-w-5xl grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/8 bg-white/[0.06] md:grid-cols-4">
      {items.map((i) => (
        <div
          key={i.l}
          className="flex items-center gap-2.5 bg-[#080808] px-4 py-4 text-[12px] text-white/60"
        >
          <i.icon className="size-4 shrink-0 text-white/35" />
          {i.l}
        </div>
      ))}
    </div>
  );
}
