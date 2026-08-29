import { useState } from "react";
import {
  useEmailMessage,
  useSimilarEmails,
  useEmailLinkActivity,
} from "@/hooks/use-email-investigations";
import {
  Loader2,
  MousePointerClick,
  Paperclip,
  Pin,
  PinOff,
  Users,
  X,
  Link as LinkIcon,
} from "lucide-react";
import { EmailHeaderAnalysis } from "@/components/soc/email-header-analysis";
import type { EmailMessageDto } from "@/types/socverse-operations";

type Tab = "message" | "headers" | "recipients" | "links";

const AUTH_TONE: Record<string, string> = {
  pass: "text-[color:var(--success)]",
  fail: "text-[color:var(--critical)]",
  softfail: "text-[color:var(--warning)]",
  none: "text-muted-foreground",
};

const REPUTATION_TONE: Record<string, string> = {
  malicious: "text-[color:var(--critical)]",
  suspicious: "text-[color:var(--warning)]",
  known_good: "text-[color:var(--success)]",
  unknown: "text-muted-foreground",
};

/**
 * The email pivot the case workspace was missing: read the actual message, then follow it
 * outward — who else got it (same sender domain), and did anyone actually click its links
 * (correlated against this session's own HTTP telemetry). Everything here is evidence the
 * Student could also assemble by hand; nothing is a ground-truth shortcut.
 */
export function EmailDetailDrawer({
  sessionId,
  emailId,
  onClose,
  onPin,
  onUnpin,
  isPinned,
  locked,
}: {
  sessionId: string;
  emailId: string;
  onClose: () => void;
  onPin?: (input: { eventTable: string; eventId: string; justification: string }) => void;
  onUnpin?: () => void;
  /** Whether this message is already pinned as evidence on the open incident. */
  isPinned?: boolean;
  locked?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("message");
  const { data: email, isPending } = useEmailMessage(sessionId, emailId);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-2xl flex-col border-l border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Email message
            </div>
            <h2 className="mt-1 truncate text-[15px] font-semibold">
              {isPending ? "Loading…" : email?.subject}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-md border border-border p-1.5 text-secondary hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {isPending || !email ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-[12.5px] text-secondary">
            <Loader2 className="size-4 animate-spin" /> Loading message…
          </div>
        ) : (
          <>
            <div className="flex gap-1 border-b border-border px-5 pt-2">
              {(
                [
                  ["message", "Message"],
                  ["headers", "Headers"],
                  ["recipients", "Who else received it"],
                  ["links", "Link activity"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`rounded-t-md px-3 py-2 text-[12px] transition-colors ${
                    tab === id
                      ? "border-b-2 border-[color:var(--info)] font-medium text-foreground"
                      : "text-secondary hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {tab === "message" && <MessageTab email={email} />}
              {tab === "headers" && <EmailHeaderAnalysis email={email} />}
              {tab === "recipients" && <RecipientsTab sessionId={sessionId} emailId={emailId} />}
              {tab === "links" && <LinksTab sessionId={sessionId} emailId={emailId} />}
            </div>

            {onPin && (
              <div className="flex items-center gap-3 border-t border-border px-5 py-3">
                {isPinned ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--success)]/40 bg-[color:var(--success)]/10 px-2.5 py-1.5 text-[12px] font-medium text-[color:var(--success)]">
                      <Pin className="size-3.5" /> Pinned as evidence
                    </span>
                    {onUnpin && (
                      <button
                        disabled={locked}
                        onClick={onUnpin}
                        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-[12px] text-secondary hover:text-foreground disabled:opacity-50"
                      >
                        <PinOff className="size-3.5" /> Unpin
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    disabled={locked}
                    onClick={() =>
                      onPin({
                        eventTable: "email_messages",
                        eventId: email.id,
                        justification: `Email from ${email.senderAddress}: "${email.subject}"`,
                      })
                    }
                    className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
                  >
                    <Pin className="size-3.5" /> Pin this email as evidence
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MessageTab({ email }: { email: EmailMessageDto }) {
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12.5px]">
        <dt className="text-muted-foreground">From</dt>
        <dd className="min-w-0">
          <span className="font-medium">{email.senderDisplayName}</span>{" "}
          <span className="font-mono text-[11.5px] text-secondary">
            &lt;{email.senderAddress}&gt;
          </span>
        </dd>
        <dt className="text-muted-foreground">To</dt>
        <dd className="min-w-0 font-mono text-[11.5px] text-secondary">
          {email.recipientAddresses.join(", ")}
        </dd>
        <dt className="text-muted-foreground">Received</dt>
        <dd>
          {new Date(email.occurredAt).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </dd>
      </dl>

      <div className="flex flex-wrap gap-2 rounded-md border border-border bg-background/40 px-3 py-2 text-[11.5px]">
        <span className="text-muted-foreground">Authentication:</span>
        {(
          [
            ["SPF", email.spfResult],
            ["DKIM", email.dkimResult],
            ["DMARC", email.dmarcResult],
          ] as const
        ).map(([label, value]) => (
          <span key={label} className="font-mono">
            {label}=<span className={AUTH_TONE[value] ?? "text-muted-foreground"}>{value}</span>
          </span>
        ))}
      </div>

      <div>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Body
        </div>
        <div
          className="prose-email max-h-[40vh] overflow-y-auto rounded-md border border-border bg-background p-3 text-[12.5px] leading-relaxed [&_a]:text-[color:var(--info)] [&_a]:underline [&_p]:mb-2"
          // Server-sanitized with an allowlist before it ever leaves the API
          // (apps/api/src/common/dto/email.dto.ts) — no scripts, no event handlers.
          dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
        />
      </div>

      {email.attachments.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Attachments
          </div>
          <ul className="divide-y divide-border rounded-md border border-border">
            {email.attachments.map((a) => (
              <li key={a.id} className="flex items-center gap-2 px-3 py-2 text-[12px]">
                <Paperclip className="size-3.5 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{a.filename}</span>
                <span className="font-mono text-[10.5px] text-muted-foreground">
                  {a.hashSha256.slice(0, 12)}…
                </span>
                <span
                  className={`text-[11px] ${REPUTATION_TONE[a.sandboxVerdict] ?? "text-muted-foreground"}`}
                >
                  {a.sandboxVerdict.replace(/_/g, " ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {email.urls.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Links in this message
          </div>
          <ul className="divide-y divide-border rounded-md border border-border">
            {email.urls.map((u) => (
              <li key={u.id} className="px-3 py-2 text-[12px]">
                <div className="flex items-center gap-2">
                  <LinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate font-mono text-[11.5px]">{u.url}</span>
                  <span
                    className={`shrink-0 text-[11px] ${REPUTATION_TONE[u.reputation] ?? "text-muted-foreground"}`}
                  >
                    {u.reputation.replace(/_/g, " ")}
                  </span>
                </div>
                {u.displayText && u.displayText !== u.url && (
                  <div className="mt-0.5 pl-5 text-[10.5px] text-muted-foreground">
                    Displayed as: “{u.displayText}”
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RecipientsTab({ sessionId, emailId }: { sessionId: string; emailId: string }) {
  const { data: similar, isPending } = useSimilarEmails(sessionId, emailId);

  if (isPending) {
    return (
      <div className="flex items-center gap-2 py-6 text-[12.5px] text-secondary">
        <Loader2 className="size-4 animate-spin" /> Checking the rest of the mail flow…
      </div>
    );
  }

  const recipients = new Set((similar ?? []).flatMap((e) => e.recipientAddresses));

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-md border border-border bg-background/40 px-3 py-2.5 text-[12.5px]">
        <Users className="mt-0.5 size-4 shrink-0 text-[color:var(--info)]" />
        <div>
          {similar && similar.length > 0 ? (
            <>
              <span className="font-medium">
                {similar.length} other message{similar.length === 1 ? "" : "s"}
              </span>{" "}
              from this sender's domain reached{" "}
              <span className="font-medium">
                {recipients.size} recipient{recipients.size === 1 ? "" : "s"}
              </span>{" "}
              in this environment.
            </>
          ) : (
            "No other messages from this sender's domain were delivered in this environment — this looks like a single, targeted message rather than a broad campaign."
          )}
        </div>
      </div>

      {similar && similar.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border">
          {similar.map((e) => (
            <li key={e.id} className="px-3 py-2.5 text-[12px]">
              <div className="truncate font-medium">{e.subject}</div>
              <div className="mt-0.5 truncate font-mono text-[11px] text-secondary">
                {e.senderAddress} → {e.recipientAddresses.join(", ")}
              </div>
              <div className="mt-0.5 text-[10.5px] text-muted-foreground">
                {new Date(e.occurredAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LinksTab({ sessionId, emailId }: { sessionId: string; emailId: string }) {
  const { data: activity, isPending } = useEmailLinkActivity(sessionId, emailId);

  if (isPending) {
    return (
      <div className="flex items-center gap-2 py-6 text-[12.5px] text-secondary">
        <Loader2 className="size-4 animate-spin" /> Correlating against endpoint web traffic…
      </div>
    );
  }

  if (!activity || activity.length === 0) {
    return (
      <p className="py-6 text-center text-[12.5px] text-secondary">
        This message contains no links — there's nothing for anyone to have clicked. If it's
        malicious, the payload is the message itself (a pretext), not a link or attachment.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {activity.map((a) => (
        <div key={a.urlId} className="rounded-md border border-border">
          <div className="border-b border-border px-3 py-2">
            <div className="truncate font-mono text-[11.5px]">{a.url}</div>
            <div className="mt-1 flex items-center gap-2 text-[11px]">
              <MousePointerClick className="size-3.5 text-muted-foreground" />
              {a.clickCount === 0 ? (
                <span className="text-[color:var(--success)]">
                  No one in this environment visited this link
                </span>
              ) : (
                <span className="text-[color:var(--critical)]">
                  {a.clickCount} visit{a.clickCount === 1 ? "" : "s"} recorded
                </span>
              )}
            </div>
          </div>
          {a.clicks.length > 0 && (
            <ul className="divide-y divide-border">
              {a.clicks.map((c, i) => (
                <li key={i} className="px-3 py-2 text-[12px]">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-medium">
                      {c.identityDisplayName ?? c.deviceHostname ?? "Unattributed request"}
                    </span>
                    {c.identityUserPrincipalName && (
                      <span className="font-mono text-[11px] text-secondary">
                        {c.identityUserPrincipalName}
                      </span>
                    )}
                    <span className="font-mono text-[10.5px] text-muted-foreground">
                      HTTP {c.statusCode}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10.5px] text-muted-foreground">
                    {new Date(c.occurredAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                    {c.deviceHostname && ` · ${c.deviceHostname}`} · {c.sourceIp}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
