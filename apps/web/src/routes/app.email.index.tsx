import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, SectionHeader, SeverityBadge } from "@/components/soc/primitives";
import { SessionPicker } from "@/components/soc/session-picker";
import { NoActiveSession } from "@/components/soc/no-active-session";
import { Skeleton, EmptyState } from "@/components/soc/ui/skeleton";
import { useActiveSession } from "@/hooks/use-active-session";
import { useEmailInvestigations } from "@/hooks/use-email-investigations";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { ExternalLink, Paperclip, Link as LinkIcon, ShieldCheck, ShieldAlert } from "lucide-react";
import type { EmailMessageDto } from "@/types/threatlens-operations";

export const Route = createFileRoute("/app/email/")({
  component: EmailPage,
  head: () => ({ meta: [{ title: "ThreatLens · Email Investigations" }] }),
});

/** No severity field exists on an email message — this reads it off the auth results the same
 * way an analyst would: any hard failure is worth a look, all three failing is the worst case. */
function authSeverity(m: EmailMessageDto) {
  const fails = [m.spfResult === "fail", m.dkimResult === "fail", m.dmarcResult === "fail"].filter(
    Boolean,
  ).length;
  if (fails >= 2) return "critical" as const;
  if (fails === 1) return "high" as const;
  return "low" as const;
}

function authTone(result: string) {
  return result === "pass"
    ? { icon: ShieldCheck, tone: "text-[color:var(--high)]" }
    : { icon: ShieldAlert, tone: "text-[color:var(--critical)]" };
}

function EmailPage() {
  const {
    isLoading: sessionsLoading,
    activeSessions,
    selectedSessionId,
    setSelectedSessionId,
  } = useActiveSession();
  const messagesQuery = useEmailInvestigations(selectedSessionId);
  const [selectedId, setSelectedId] = useState<string>();

  const messages = messagesQuery.data ?? [];
  // No effect needed to seed the selection — falling back to the first message here covers
  // both "nothing picked yet" and the previous pick disappearing from the list.
  const selected = messages.find((m) => m.id === selectedId) ?? messages[0];

  if (sessionsLoading) {
    return (
      <div className="px-4 py-6 md:px-8 md:py-8">
        <SectionHeader title="Email Investigations" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!selectedSessionId) {
    return <NoActiveSession title="Email Investigations" />;
  }

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Email Investigations"
        description="Message-level forensics for this investigation — headers, auth results, attachments, and URLs."
        actions={
          <SessionPicker
            sessions={activeSessions}
            selectedId={selectedSessionId}
            onChange={setSelectedSessionId}
          />
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Panel title="Messages" padded={false}>
          {messagesQuery.isPending ? (
            <div className="flex flex-col gap-px p-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : messages.length === 0 ? (
            <EmptyState
              title="No messages"
              description="This session has no generated email traffic."
            />
          ) : (
            <ul className="divide-y divide-border">
              {messages.map((m) => (
                <li
                  key={m.id}
                  onClick={() => setSelectedId(m.id)}
                  className={`cursor-pointer px-3 py-3 hover:bg-background/40 ${m.id === selected?.id ? "bg-background/40" : ""}`}
                >
                  <div className="flex items-center justify-between text-[10.5px] text-muted-foreground">
                    <span className="truncate font-mono">{m.senderAddress}</span>
                    <span>{formatRelativeTime(m.occurredAt)}</span>
                  </div>
                  <div className="mt-1 truncate text-[13px] font-medium">{m.subject}</div>
                  <div className="mt-2">
                    <SeverityBadge level={authSeverity(m)} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {!selected ? (
          <Panel>
            <p className="text-[12px] text-secondary">Select a message to see its details.</p>
          </Panel>
        ) : (
          <div className="space-y-4">
            <Panel>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{selected.direction}</span>
                    <span>·</span>
                    <span>{formatRelativeTime(selected.occurredAt)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <h2 className="text-lg font-semibold tracking-tight">{selected.subject}</h2>
                    <Link
                      to="/app/email/$sessionId/$messageId"
                      params={{ sessionId: selectedSessionId, messageId: selected.id }}
                      className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-border px-2 py-1 text-[11px] text-[color:var(--info)] hover:bg-background/40"
                    >
                      Full investigation <ExternalLink className="size-3" />
                    </Link>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-[12px] sm:grid-cols-2">
                    <div>
                      <span className="text-muted-foreground">From </span>
                      <span className="font-mono">
                        {selected.senderDisplayName} &lt;{selected.senderAddress}&gt;
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">To </span>
                      <span className="font-mono">{selected.recipientAddresses.join(", ")}</span>
                    </div>
                  </div>
                </div>
                <SeverityBadge level={authSeverity(selected)} />
              </div>
            </Panel>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {(
                [
                  ["SPF", selected.spfResult],
                  ["DKIM", selected.dkimResult],
                  ["DMARC", selected.dmarcResult],
                ] as const
              ).map(([k, v]) => {
                const { icon: Icon, tone } = authTone(v);
                return (
                  <Panel key={k}>
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                      <Icon className={`size-3.5 ${tone}`} /> {k}
                    </div>
                    <div className={`mt-1 text-lg font-semibold ${tone}`}>{v}</div>
                  </Panel>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Panel title="Embedded URLs">
                {selected.urls.length === 0 ? (
                  <p className="text-[12px] text-secondary">No URLs in this message.</p>
                ) : (
                  <ul className="space-y-2 text-[12px]">
                    {selected.urls.map((u) => (
                      <li
                        key={u.id}
                        className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-2.5 py-2"
                      >
                        <LinkIcon className="size-3.5 text-muted-foreground" />
                        <span className="flex-1 truncate font-mono text-[11.5px]">
                          {u.displayText}
                        </span>
                        <span className="text-[10.5px] uppercase text-muted-foreground">
                          {u.reputation}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              <Panel title="Attachments & sandbox">
                {selected.attachments.length === 0 ? (
                  <p className="text-[12px] text-secondary">No attachments.</p>
                ) : (
                  <ul className="space-y-2 text-[12px]">
                    {selected.attachments.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-2.5 py-2"
                      >
                        <Paperclip className="size-3.5 text-muted-foreground" />
                        <span className="flex-1 truncate font-mono text-[11.5px]">
                          {a.filename}
                        </span>
                        <span className="text-[10.5px] uppercase text-[color:var(--critical)]">
                          {a.sandboxVerdict}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>

            <Panel title="Message body">
              <div
                className="prose prose-sm max-w-none text-[12.5px]"
                // Sanitized server-side (allowlisted tags/attrs only) before it ever leaves the API.
                dangerouslySetInnerHTML={{ __html: selected.bodyHtml }}
              />
            </Panel>

            <Panel
              title="Header analysis"
              actions={
                <Link
                  to="/app/email/$sessionId/$messageId"
                  params={{ sessionId: selectedSessionId, messageId: selected.id }}
                  hash="headers"
                  className="text-[11.5px] text-[color:var(--info)] hover:underline"
                >
                  Open full analyzer →
                </Link>
              }
            >
              <p className="text-[12px] text-secondary">
                Full authentication-chain forensics — SPF/DKIM/DMARC breakdown, Reply-To and
                Return-Path mismatches, and the Received-header routing path — are in the full
                investigation workspace, not a raw header dump here.
              </p>
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}
