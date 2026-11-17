import { useEffect, useState } from "react";
import { ArrowRight, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { useAuthStore, type AuthUser } from "@/lib/auth-store";

const INPUT =
  "w-full rounded-lg border border-black/15 bg-black/[0.015] px-3.5 py-3 text-[14px] text-[#0A0C0F] outline-none transition-colors placeholder:text-black/30 focus:border-black/40";

type EnrolmentSetup = { secret: string; otpauthUrl: string; qrCodeDataUrl: string };

// One setup request per enrolment challenge. Every setup call generates a fresh secret on the
// server, so two of them race: the QR code shows one secret while the account stores the
// other, and every code the person types is then rejected. React runs effects twice in
// development, which is how this was found, and a remount does the same in production.
const setupByChallenge = new Map<string, Promise<EnrolmentSetup>>();

function setupOnce(
  enrolmentChallengeId: string,
  start: (id: string) => Promise<EnrolmentSetup>,
): Promise<EnrolmentSetup> {
  let pending = setupByChallenge.get(enrolmentChallengeId);
  if (!pending) {
    pending = start(enrolmentChallengeId);
    setupByChallenge.set(enrolmentChallengeId, pending);
    // A failed attempt must not be cached, or a retry could never succeed.
    pending.catch(() => setupByChallenge.delete(enrolmentChallengeId));
  }
  return pending;
}

/**
 * Two-factor enrolment for an account that hasn't set it up — which, now that MFA is
 * mandatory for every account, is every new account straight after signup and any older one
 * on its next sign-in.
 *
 * This runs *before* login completes — the account holds an enrolment challenge, not a token.
 * Without this step, enforcing mandatory MFA would be a trap: the setup endpoints need a token,
 * and the token is exactly what is being withheld until MFA exists.
 *
 * The recovery-code screen is deliberately the most emphatic thing on the page. The
 * password-reset path does not clear MFA, so if the authenticator is lost these codes are the
 * only self-service route back in. It requires an explicit acknowledgement rather than a
 * dismissable notice, because the failure mode is silent until the day it matters.
 */
export function MfaEnrolment({
  enrolmentChallengeId,
  context,
  onDone,
}: {
  enrolmentChallengeId: string;
  /** "signup": the last step of creating an account. "login": an existing account that has
   * never set it up, meeting the requirement for the first time. */
  context: "signup" | "login";
  /** Called once the codes are acknowledged; the caller decides where the person lands. */
  onDone: (user: AuthUser) => void | Promise<void>;
}) {
  const startMfaEnrolment = useAuthStore((s) => s.startMfaEnrolment);
  const completeMfaEnrolment = useAuthStore((s) => s.completeMfaEnrolment);

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setupOnce(enrolmentChallengeId, startMfaEnrolment)
      .then((setup) => {
        if (cancelled) return;
        setQrCodeDataUrl(setup.qrCodeDataUrl);
        setSecret(setup.secret);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Could not start two-factor setup.");
      });
    return () => {
      cancelled = true;
    };
  }, [enrolmentChallengeId, startMfaEnrolment]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await completeMfaEnrolment(enrolmentChallengeId, code.trim());
      setSubmitting(false);
      setUser(result.user);
      setRecoveryCodes(result.recoveryCodes);
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof ApiError ? err.message : "That code was not accepted. Try again.");
    }
  }

  // Recovery codes are shown once and never again.
  if (recoveryCodes) {
    return (
      <div className="w-full max-w-[400px]">
        <div className="mb-4 flex items-center gap-2 text-[color:var(--success)]">
          <ShieldCheck className="size-4" />
          <span className="text-[13px] font-medium">Two-factor authentication is on</span>
        </div>

        <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-[#0A0C0F]">
          Save your recovery codes
        </h2>

        <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-[color:var(--high)]/40 bg-[color:var(--high)]/5 px-3 py-2.5">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[color:var(--high)]" />
          <p className="text-[12.5px] leading-[1.6] text-black/75">
            These are shown once. Resetting your password does <strong>not</strong> turn two-factor
            off — if you lose your authenticator app, these codes are how you sign in. Without them
            you will need to contact support to get back into your account.
          </p>
        </div>

        <ul className="mt-3 grid grid-cols-2 gap-1.5 rounded-lg border border-black/15 bg-black/[0.015] p-3">
          {recoveryCodes.map((rc) => (
            <li key={rc} className="font-mono text-[12.5px] text-[#0A0C0F]">
              {rc}
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(recoveryCodes.join("\n"))}
          className="mt-2 text-[12px] text-black/55 underline hover:text-black"
        >
          Copy all codes
        </button>

        <label className="mt-4 flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-[12.5px] text-black/75">
            I have saved these codes somewhere I can get to without this device.
          </span>
        </label>

        <button
          type="button"
          disabled={!acknowledged || !user}
          onClick={() => user && void onDone(user)}
          className="btn-primary mt-4 w-full justify-center py-3 disabled:opacity-50"
        >
          Continue <ArrowRight className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[400px]">
      {context === "signup" && (
        <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-black/45">
          Account created · last step
        </p>
      )}
      <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-[#0A0C0F]">
        {context === "signup" ? "Secure your account" : "Set up two-factor authentication"}
      </h2>
      <p className="mt-2 text-[13.5px] leading-[1.6] text-black/55">
        {context === "signup"
          ? "Every ThreatLens account uses two-factor authentication. Scan the code with an authenticator app — Google Authenticator, Microsoft Authenticator, 1Password or similar — then enter the 6-digit code it shows."
          : "Two-factor authentication is now required on every ThreatLens account. Set it up once and you're in — scan the code with an authenticator app, then enter the 6-digit code it shows."}
      </p>

      {qrCodeDataUrl ? (
        <>
          <div className="mt-5 flex justify-center rounded-lg border border-black/15 bg-white p-4">
            <img src={qrCodeDataUrl} alt="Two-factor setup QR code" className="size-40" />
          </div>
          <p className="mt-2 text-center text-[11.5px] text-black/55">
            Scan with an authenticator app, or enter this key manually:
          </p>
          <p className="mt-1 break-all text-center font-mono text-[11px] text-black/70">{secret}</p>

          <form className="mt-5 space-y-3" onSubmit={handleVerify}>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-black/70">
                Enter the 6-digit code
              </span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                className={INPUT}
              />
            </label>

            {error && (
              <p className="rounded-lg border border-[color:var(--critical)]/30 bg-[color:var(--critical)]/5 px-3 py-2 text-[12.5px] text-[color:var(--critical)]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full justify-center py-3 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> Verifying…
                </>
              ) : (
                <>
                  Turn on two-factor <ArrowRight className="size-3.5" />
                </>
              )}
            </button>
          </form>
        </>
      ) : (
        <div className="mt-6 flex items-center gap-2 text-[13px] text-black/55">
          {error ? (
            <span className="text-[color:var(--critical)]">{error}</span>
          ) : (
            <>
              <Loader2 className="size-3.5 animate-spin" /> Preparing setup…
            </>
          )}
        </div>
      )}
    </div>
  );
}
