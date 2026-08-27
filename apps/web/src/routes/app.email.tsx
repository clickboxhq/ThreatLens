import { createFileRoute } from "@tanstack/react-router";
import { Panel, SectionHeader, SeverityBadge } from "@/components/soc/primitives";
import { useEmailInvestigations } from "@/hooks/use-email-investigations";
import type { Severity } from "@/types/common";
import { Paperclip, Link as LinkIcon, ShieldCheck, ShieldAlert, Copy } from "lucide-react";

export const Route = createFileRoute("/app/email")({
  component: EmailPage,
  head: () => ({ meta: [{ title: "ThreatLens · Email Investigations" }] }),
});

function EmailPage() {
  const { messages } = useEmailInvestigations();
  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Email Investigations"
        description="Message-level forensics with headers, auth results, attachments, URLs, and detonation."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Panel title="Suspicious messages" padded={false}>
          <ul className="divide-y divide-border">
            {messages.map((m, i) => (
              <li
                key={m.id}
                className={`px-3 py-3 hover:bg-background/40 ${i === 0 ? "bg-background/40" : ""}`}
              >
                <div className="flex items-center justify-between text-[10.5px] text-muted-foreground">
                  <span className="font-mono">{m.id}</span>
                  <span>{m.when}</span>
                </div>
                <div className="mt-1 text-[13px] font-medium">{m.subj}</div>
                <div className="mt-0.5 truncate font-mono text-[11px] text-secondary">{m.from}</div>
                <div className="mt-2">
                  <SeverityBadge level={m.sev} />
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-mono">MSG-3121</span>
                  <span>·</span>
                  <span>Delivered to Inbox → auto-quarantined 08:04</span>
                </div>
                <h2 className="mt-1 text-lg font-semibold tracking-tight">
                  Adobe subscription — action required
                </h2>
                <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-[12px] sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground">From </span>
                    <span className="font-mono">billing@adobe-secure-invoice.com</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">To </span>
                    <span className="font-mono">sarah.chen@contoso.com</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Return-Path </span>
                    <span className="font-mono">bounce@mailer-31.rr-out.com</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">IP </span>
                    <span className="font-mono">185.220.101.44 · TOR exit</span>
                  </div>
                </div>
              </div>
              <SeverityBadge level="high" />
            </div>
          </Panel>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              ["SPF", "fail", "critical"],
              ["DKIM", "none", "high"],
              ["DMARC", "fail (p=reject)", "critical"],
            ].map(([k, v, tone]) => (
              <Panel key={k as string}>
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                  {tone === "critical" ? (
                    <ShieldAlert className="size-3.5 text-[color:var(--critical)]" />
                  ) : (
                    <ShieldCheck className="size-3.5 text-[color:var(--high)]" />
                  )}
                  {k}
                </div>
                <div
                  className={`mt-1 text-lg font-semibold ${tone === "critical" ? "text-[color:var(--critical)]" : "text-[color:var(--high)]"}`}
                >
                  {v}
                </div>
              </Panel>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Panel title="Embedded URLs">
              <ul className="space-y-2 text-[12px]">
                {[
                  ["hxxps://adobe-secure-invoice.com/renew?u=...", "high"],
                  ["hxxps://cdn.adobestatic.com/img/lockup.png", "low"],
                  ["hxxps://tracker.mkt-out.net/o/49x/", "medium"],
                ].map(([u, sev]) => (
                  <li
                    key={u}
                    className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-2.5 py-2"
                  >
                    <LinkIcon className="size-3.5 text-muted-foreground" />
                    <span className="flex-1 truncate font-mono text-[11.5px]">{u}</span>
                    <SeverityBadge level={sev as Severity} />
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Attachments & sandbox">
              <ul className="space-y-2 text-[12px]">
                <li className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-2.5 py-2">
                  <Paperclip className="size-3.5 text-muted-foreground" />
                  <span className="flex-1 truncate font-mono text-[11.5px]">Invoice-4429.htm</span>
                  <SeverityBadge level="critical" />
                </li>
                <li className="text-[11.5px] text-secondary">
                  Detonation verdict:{" "}
                  <span className="text-[color:var(--critical)]">malicious</span> · credential
                  harvester (Adobe brand impersonation).
                </li>
                <li className="text-[11.5px] text-secondary">
                  Campaign correlation: <span className="font-mono">Storm-1811-C</span> · 87 similar
                  messages tenant-wide.
                </li>
              </ul>
            </Panel>
          </div>

          <Panel
            title="Raw headers"
            actions={
              <button className="inline-flex items-center gap-1 text-[11px] text-secondary">
                <Copy className="size-3" /> Copy
              </button>
            }
          >
            <pre className="max-h-56 overflow-auto rounded-md border border-border bg-background p-3 font-mono text-[11px] leading-relaxed text-secondary">
              {`Received: from mailer-31.rr-out.com (185.220.101.44) by contoso-mx.contoso.com
Authentication-Results: contoso.com; spf=fail (sender IP is 185.220.101.44)
  smtp.mailfrom=bounce@mailer-31.rr-out.com; dkim=none; dmarc=fail action=reject
Message-ID: <5d1c0a1c-4e7b-adobe-secure@mailer-31.rr-out.com>
From: "Adobe Billing" <billing@adobe-secure-invoice.com>
Subject: Adobe subscription — action required
X-ThreatLens-Verdict: PHISH/BRAND-IMPERSONATION`}
            </pre>
          </Panel>
        </div>
      </div>
    </div>
  );
}
