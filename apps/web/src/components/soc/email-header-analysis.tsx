import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { EmailMessageDto } from "@/types/threatlens-operations";

type Finding = {
  severity: "suspicious" | "clean" | "info";
  label: string;
  detail: string;
};

function domainOf(address: string): string | null {
  const m = address.match(/@([^\s>]+)/);
  return m ? m[1].toLowerCase().replace(/[>,]+$/, "") : null;
}

/** Headers arrive as a JSON object keyed by header name; values are strings or (for Received)
 * an array of hops. Everything is read defensively — older sessions were generated before the
 * fuller header set existed and only carry Received-Chain + Authentication-Results. */
function headerMap(raw: unknown): Record<string, string | string[]> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, string | string[]>;
}

function asString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v.join(", ");
  return v;
}

/**
 * Derives the findings an analyst would read out of a message's headers. Everything here comes
 * from the headers themselves — no ground-truth flag is consulted, so a legitimate message
 * genuinely produces a clean result and a spoofed one genuinely produces the tells. That is the
 * whole point: the Student has to read the evidence, not a label.
 */
export function analyzeHeaders(email: EmailMessageDto): Finding[] {
  const h = headerMap(email.headersRaw);
  const findings: Finding[] = [];

  const fromDomain = domainOf(email.senderAddress);
  const replyTo = asString(h["Reply-To"]);
  const returnPath = asString(h["Return-Path"]);

  // 1. Authentication results — the single strongest signal of a spoofed sender.
  const authFailures: string[] = [];
  if (email.spfResult === "fail" || email.spfResult === "softfail")
    authFailures.push(`SPF ${email.spfResult}`);
  if (email.dkimResult === "fail" || email.dkimResult === "none")
    authFailures.push(`DKIM ${email.dkimResult}`);
  if (email.dmarcResult === "fail" || email.dmarcResult === "none")
    authFailures.push(`DMARC ${email.dmarcResult}`);

  if (authFailures.length > 0) {
    findings.push({
      severity: "suspicious",
      label: "Sender authentication failed",
      detail: `${authFailures.join(", ")}. The sending server was not authorised to send as ${fromDomain ?? "this domain"}, which is what you would expect from a spoofed or lookalike sender.`,
    });
  } else {
    findings.push({
      severity: "clean",
      label: "Sender authentication passed",
      detail: `SPF, DKIM and DMARC all pass for ${fromDomain ?? "this domain"} — the message really was sent by this domain's own mail system. Note this proves the domain, not the intent.`,
    });
  }

  // 2. Reply-To pointing somewhere other than From — the defining BEC tell.
  if (replyTo) {
    const replyDomain = domainOf(replyTo);
    const replyAddress = replyTo.replace(/[<>]/g, "");
    if (replyAddress.toLowerCase() !== email.senderAddress.toLowerCase()) {
      findings.push({
        severity: replyDomain === fromDomain ? "info" : "suspicious",
        label: "Replies are redirected",
        detail: `A reply to this message goes to ${replyAddress}, not to the address it appears to be from (${email.senderAddress}).${
          replyDomain === fromDomain
            ? " Same domain, so this may be legitimate routing — but worth confirming."
            : " A different domain entirely: anyone replying would be corresponding with the sender of this message, not the person it claims to be from."
        }`,
      });
    }
  }

  // 3. Envelope sender vs header sender.
  if (returnPath) {
    const rpAddress = returnPath.replace(/[<>]/g, "");
    if (rpAddress.toLowerCase() !== email.senderAddress.toLowerCase()) {
      findings.push({
        severity: domainOf(rpAddress) === fromDomain ? "info" : "suspicious",
        label: "Return-Path does not match From",
        detail: `Bounces go to ${rpAddress} while the message displays as being from ${email.senderAddress}. Mismatches are common in bulk mail, but on a targeted message they suggest the visible sender was set by hand.`,
      });
    }
  }

  // 4. Display name vs actual address — the "looks like the CFO" problem.
  if (fromDomain && email.senderDisplayName) {
    const nameLooksInternal =
      /\b(ceo|cfo|cto|chief|director|it|helpdesk|support|admin|payroll|finance)\b/i.test(
        email.senderDisplayName,
      );
    if (nameLooksInternal) {
      findings.push({
        severity: "info",
        label: "Display name claims authority",
        detail: `The message displays as "${email.senderDisplayName}" but was actually sent from ${email.senderAddress}. Display names are free text and set entirely by the sender — always judge the address and the authentication results, never the name.`,
      });
    }
  }

  // 5. Where it actually entered the mail flow.
  const received = h["Received"] ?? h["Received-Chain"];
  if (Array.isArray(received) && received.length > 0) {
    const origin = received[received.length - 1];
    findings.push({
      severity: "info",
      label: "Origin of the message",
      detail: `Earliest recorded hop: ${origin}. Compare this against where mail from ${fromDomain ?? "this domain"} would legitimately originate.`,
    });
  }

  return findings;
}

const SEVERITY_STYLE: Record<Finding["severity"], { icon: typeof Info; cls: string }> = {
  suspicious: { icon: AlertTriangle, cls: "text-[color:var(--critical)]" },
  clean: { icon: CheckCircle2, cls: "text-[color:var(--success)]" },
  info: { icon: Info, cls: "text-[color:var(--info)]" },
};

export function EmailHeaderAnalysis({ email }: { email: EmailMessageDto }) {
  const findings = analyzeHeaders(email);
  const h = headerMap(email.headersRaw);
  const suspicious = findings.filter((f) => f.severity === "suspicious").length;

  // Rendered in the conventional order a mail client's "show original" uses, so the raw block
  // reads like the real thing rather than an arbitrary object dump.
  const ORDER = [
    "Return-Path",
    "Received",
    "Message-ID",
    "Date",
    "From",
    "Reply-To",
    "To",
    "Subject",
    "Authentication-Results",
    "X-Originating-IP",
    "MIME-Version",
    "Content-Type",
    "Received-Chain",
  ];
  const keys = [
    ...ORDER.filter((k) => k in h),
    ...Object.keys(h).filter((k) => !ORDER.includes(k)),
  ];

  return (
    <div className="space-y-4">
      <div
        className={`rounded-md border px-3 py-2.5 text-[12.5px] ${
          suspicious > 0
            ? "border-[color:var(--critical)]/40 bg-[color:var(--critical)]/5"
            : "border-[color:var(--success)]/40 bg-[color:var(--success)]/5"
        }`}
      >
        {suspicious > 0
          ? `${suspicious} indicator${suspicious === 1 ? "" : "s"} in these headers suggest the sender is not who the message appears to be from.`
          : "Nothing in these headers contradicts the sender's identity. Clean headers do not make a message safe — judge the content and the request as well."}
      </div>

      <div>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Analysis
        </div>
        <ul className="space-y-2">
          {findings.map((f, i) => {
            const { icon: Icon, cls } = SEVERITY_STYLE[f.severity];
            return (
              <li key={i} className="flex items-start gap-2 rounded-md border border-border p-2.5">
                <Icon className={`mt-0.5 size-3.5 shrink-0 ${cls}`} />
                <div>
                  <div className={`text-[12px] font-medium ${cls}`}>{f.label}</div>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-secondary">{f.detail}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Raw headers
        </div>
        {keys.length === 0 ? (
          <p className="text-[12px] text-secondary">No headers were captured for this message.</p>
        ) : (
          <pre className="max-h-[40vh] overflow-auto rounded-md border border-border bg-background p-3 text-[11px] leading-relaxed">
            {keys
              .map((k) => {
                const v = h[k];
                return Array.isArray(v)
                  ? v.map((line) => `${k}: ${line}`).join("\n")
                  : `${k}: ${String(v)}`;
              })
              .join("\n")}
          </pre>
        )}
      </div>
    </div>
  );
}
