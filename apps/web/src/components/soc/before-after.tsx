import {
  AlertTriangle,
  Mail,
  MessageSquare,
  Monitor,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

/**
 * Before / After split — chaotic fan of disconnected tool panels on the left,
 * one clean resolved ClickBox investigation card on the right.
 */
export function BeforeAfter() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <div
          className="text-[11px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: "#FFFFFF" }}
        >
          What it does
        </div>
        <h2
          className="mt-3 text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] text-white md:text-[44px]"
          style={{ fontFamily: 'Geist, "Inter", system-ui, sans-serif' }}
        >
          From raw telemetry to answered incidents.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[14.5px] leading-[1.6] text-white/60">
          One console handles the full analyst workflow — end to end, in minutes.
        </p>
      </div>

      <div className="relative mt-14 grid grid-cols-1 gap-6 overflow-hidden rounded-3xl border border-white/10 bg-[#0A0A0A]/70 backdrop-blur-xl md:grid-cols-2 md:gap-0">
        {/* seam */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-6 left-1/2 hidden w-px md:block"
          style={{
            background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.14), transparent)",
          }}
        />

        {/* ambient */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(600px 300px at 85% 60%, rgba(255,255,255,0.14), transparent 65%)",
          }}
        />

        <BeforeSide />
        <AfterSide />
      </div>
    </section>
  );
}

/* ---------------- Before ---------------- */

function BeforeSide() {
  return (
    <div className="relative min-h-[440px] overflow-hidden p-8 md:p-10">
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.14em] text-white/55"
        style={{ fontFamily: '"Geist Mono", monospace' }}
      >
        Without ThreatLens
      </span>
      <h3
        className="mt-4 text-[38px] font-semibold leading-none tracking-[-0.03em] text-white/85 md:text-[52px]"
        style={{ fontFamily: "Geist, Inter, sans-serif" }}
      >
        Alert noise.
      </h3>

      {/* fan of panels */}
      <div className="relative mx-auto mt-8 h-[300px] w-full max-w-[440px]">
        {/* SIEM feed */}
        <MockPanel
          className="left-0 top-2 w-[280px] rotate-[-9deg]"
          header={{
            icon: <AlertTriangle className="size-3.5 text-[#EF3B50]" />,
            title: "raw-siem.log",
          }}
          desaturate
        >
          <LogRow sev="crit" text="4625 · logon failure · svc_backup" />
          <LogRow sev="warn" text="4688 · powershell.exe -enc ..." />
          <LogRow sev="warn" text="EDR: suspicious child process" />
          <LogRow sev="info" text="4776 · NTLM auth · DC-02" />
          <LogRow sev="crit" text="4625 · logon failure · svc_backup" />
          <LogRow sev="warn" text="Kerberos pre-auth failed" />
        </MockPanel>

        {/* Email phishing */}
        <MockPanel
          className="right-0 top-0 w-[240px] rotate-[7deg]"
          header={{ icon: <Mail className="size-3.5 text-white/50" />, title: "Inbox — Security" }}
          desaturate
        >
          <MailRow subject="Urgent: DocuSign pending" from="no-reply@doocusign.co" flag />
          <MailRow subject="Payroll update required" from="hr-team@corp-payrol.io" flag />
          <MailRow subject="Re: Q3 forecast" from="cfo@company.com" />
        </MockPanel>

        {/* EDR console */}
        <MockPanel
          className="left-8 bottom-0 w-[230px] rotate-[4deg]"
          header={{
            icon: <Monitor className="size-3.5 text-white/50" />,
            title: "EDR · endpoint-042",
          }}
          desaturate
        >
          <div className="space-y-1.5">
            <div className="h-1.5 rounded bg-white/15" style={{ width: "82%" }} />
            <div className="h-1.5 rounded bg-white/10" style={{ width: "60%" }} />
            <div className="h-1.5 rounded bg-white/10" style={{ width: "44%" }} />
            <div
              className="mt-2 text-[9.5px] text-white/40"
              style={{ fontFamily: '"Geist Mono", monospace' }}
            >
              3 processes flagged · unreviewed
            </div>
          </div>
        </MockPanel>

        {/* Slack thread */}
        <MockPanel
          className="right-6 bottom-4 w-[220px] rotate-[-5deg]"
          header={{
            icon: <MessageSquare className="size-3.5 text-white/50" />,
            title: "#sec-oncall",
          }}
          desaturate
        >
          <ChatLine who="alex" text="did anyone check this alert?" />
          <ChatLine who="priya" text="which one 😅" />
          <ChatLine who="alex" text="the svc_backup one" />
        </MockPanel>
      </div>
    </div>
  );
}

/* ---------------- After ---------------- */

function AfterSide() {
  return (
    <div className="relative min-h-[440px] p-8 md:p-10">
      <div className="flex items-center justify-between">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.14em]"
          style={{
            fontFamily: '"Geist Mono", monospace',
            background: "rgba(255,255,255,0.10)",
            color: "#8FD5F0",
            border: "1px solid rgba(255,255,255,0.3)",
          }}
        >
          With ThreatLens
        </span>
      </div>
      <h3
        className="mt-4 text-[38px] font-semibold leading-none tracking-[-0.03em] text-white md:text-[52px]"
        style={{ fontFamily: "Geist, Inter, sans-serif" }}
      >
        Resolved.
      </h3>

      {/* clean investigation card */}
      <div
        className="mt-8 overflow-hidden rounded-xl border border-white/12 bg-[#111111]"
        style={{ boxShadow: "0 30px 60px -30px rgba(0,0,0,0.7)" }}
      >
        <div className="flex items-center justify-between border-b border-white/8 bg-black/30 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-3.5" style={{ color: "#FFFFFF" }} />
            <span
              className="text-[11px] font-medium text-white/70"
              style={{ fontFamily: '"Geist Mono", monospace' }}
            >
              INC-4821 · Credential stuffing → svc_backup
            </span>
          </div>
          <span
            className="rounded-full px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.12em]"
            style={{
              background: "color-mix(in oklab, var(--success) 16%, transparent)",
              color: "var(--success)",
              border: "1px solid color-mix(in oklab, var(--success) 40%, transparent)",
            }}
          >
            Contained
          </span>
        </div>

        <div className="space-y-3 p-4">
          <div className="flex items-start gap-2.5">
            <Sparkles className="mt-0.5 size-3.5 shrink-0" style={{ color: "#FFFFFF" }} />
            <p className="text-[12.5px] leading-[1.55] text-white/80">
              18,412 raw events correlated into <span className="text-white">1 incident</span>.
              Phishing email delivered credentials, used from unmanaged host to brute-force{" "}
              <span className="font-mono text-white">svc_backup</span> against DC-02.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1">
            <Stat k="Events" v="18,412" />
            <Stat k="Alerts" v="47 → 1" />
            <Stat k="MTTR" v="3m 12s" />
          </div>

          <div className="rounded-lg border border-white/8 bg-black/30 p-3">
            <div
              className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45"
              style={{ fontFamily: '"Geist Mono", monospace' }}
            >
              Recommended action
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[12.5px] text-white/85">
                <CheckCircle2 className="size-3.5" style={{ color: "#FFFFFF" }} />
                Disable svc_backup, revoke sessions, quarantine host-042.
              </div>
              <button
                className="shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium"
                style={{
                  background: "var(--primary)",
                  color: "var(--primary-foreground)",
                  boxShadow: "0 0 0 1px color-mix(in oklab, var(--primary) 70%, transparent)",
                }}
              >
                Run playbook
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- primitives ---------------- */

function MockPanel({
  className = "",
  header,
  children,
  desaturate,
}: {
  className?: string;
  header: { icon: React.ReactNode; title: string };
  children: React.ReactNode;
  desaturate?: boolean;
}) {
  return (
    <div
      className={`absolute overflow-hidden rounded-lg border border-white/8 bg-[#0A0A0A] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.7)] ${className}`}
      style={desaturate ? { filter: "saturate(0.7) brightness(0.92)" } : undefined}
    >
      <div className="flex items-center gap-1.5 border-b border-white/6 bg-black/40 px-2.5 py-1.5">
        {header.icon}
        <span
          className="text-[10px] text-white/55"
          style={{ fontFamily: '"Geist Mono", monospace' }}
        >
          {header.title}
        </span>
      </div>
      <div className="space-y-1 p-2.5 text-[10.5px] text-white/65">{children}</div>
    </div>
  );
}

function LogRow({ sev, text }: { sev: "crit" | "warn" | "info"; text: string }) {
  const color = sev === "crit" ? "#EF3B50" : sev === "warn" ? "#f0b429" : "rgba(255,255,255,0.35)";
  return (
    <div className="flex items-center gap-2 truncate">
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className="truncate" style={{ fontFamily: '"Geist Mono", monospace' }}>
        {text}
      </span>
    </div>
  );
}

function MailRow({ subject, from, flag }: { subject: string; from: string; flag?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span
        className="mt-1 size-1.5 shrink-0 rounded-full"
        style={{ background: flag ? "#EF3B50" : "rgba(255,255,255,0.25)" }}
      />
      <div className="min-w-0">
        <div className="truncate text-white/80">{subject}</div>
        <div
          className="truncate text-[9.5px] text-white/40"
          style={{ fontFamily: '"Geist Mono", monospace' }}
        >
          {from}
        </div>
      </div>
    </div>
  );
}

function ChatLine({ who, text }: { who: string; text: string }) {
  return (
    <div className="flex gap-1.5 truncate">
      <span className="text-white/45" style={{ fontFamily: '"Geist Mono", monospace' }}>
        {who}:
      </span>
      <span className="truncate text-white/70">{text}</span>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md border border-white/8 bg-black/25 px-3 py-2">
      <div
        className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-white/45"
        style={{ fontFamily: '"Geist Mono", monospace' }}
      >
        {k}
      </div>
      <div
        className="mt-0.5 text-[15px] font-semibold text-white"
        style={{ fontFamily: "Geist, Inter, sans-serif" }}
      >
        {v}
      </div>
    </div>
  );
}
