import { useState } from "react";
import { CheckCircle2, Mail } from "lucide-react";
import { useAuthStore, useAuthUser } from "@/lib/auth-store";
import { ApiError } from "@/lib/api-client";

// Real gap this closes: EMAIL_VERIFICATION_REQUIRED errors (e.g. launching a scenario) used to
// tell the Student to "check the banner on your dashboard" — a banner that never actually
// existed anywhere in the app. Rendered in AppShell so it's visible on every /app/* page, not
// just the dashboard, since that's wherever the gate is actually likely to be hit.
export function EmailVerificationBanner() {
  const user = useAuthUser();
  const requestEmailVerification = useAuthStore((s) => s.requestEmailVerification);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user || user.emailVerified) return null;

  async function resend() {
    setSending(true);
    setError(null);
    try {
      await requestEmailVerification();
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the email. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--warning)]/30 bg-[color:var(--warning)]/10 px-4 py-2.5 text-[12.5px] md:px-8">
      <div className="flex items-center gap-2">
        <Mail className="size-4 text-[color:var(--warning)]" />
        <span>
          Verify your email address to start a scenario — check your inbox for the link we sent when
          you signed up.
        </span>
      </div>
      <div className="flex items-center gap-2">
        {sent ? (
          <span className="inline-flex items-center gap-1.5 text-[color:var(--success)]">
            <CheckCircle2 className="size-3.5" /> Verification email sent
          </span>
        ) : (
          <button
            onClick={resend}
            disabled={sending}
            className="rounded-md border border-[color:var(--warning)]/40 px-2.5 py-1 text-[12px] font-medium text-foreground hover:bg-[color:var(--warning)]/10 disabled:opacity-60"
          >
            {sending ? "Sending…" : "Resend verification email"}
          </button>
        )}
        {error && <span className="text-[color:var(--critical)]">{error}</span>}
      </div>
    </div>
  );
}
