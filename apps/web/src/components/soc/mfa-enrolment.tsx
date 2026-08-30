import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";

const INPUT =
  "w-full rounded-lg border border-black/15 bg-black/[0.015] px-3.5 py-3 text-[14px] text-[#0A0C0F] outline-none transition-colors placeholder:text-black/30 focus:border-black/40";

/**
 * Enrolment for an account whose role requires MFA and hasn't set it up.
 *
 * This runs *before* login completes — the account holds an enrolment challenge, not a token.
 * Without this step, enforcing mandatory MFA would be a trap: the setup endpoints need a token,
 * and the token is exactly what is being withheld until MFA exists.
 *
 * The recovery-code screen is deliberately the most emphatic thing on the page. For these roles
 * the password-reset path does not clear MFA, so if the authenticator is lost these codes are
 * the only remaining route into the account. It requires an explicit acknowledgement rather
 * than a dismissable notice, because the failure mode is permanent and silent.
 */
export function MfaEnrolment({ enrolmentChallengeId }: { enrolmentChallengeId: string }) {
  const navigate = useNavigate();
  const startMfaEnrolment = useAuthStore((s) => s.startMfaEnrolment);
  const completeMfaEnrolment = useAuthStore((s) => s.completeMfaEnrolment);

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    startMfaEnrolment(enrolmentChallengeId)
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
            These are shown once. For an admin account, resetting your password does{" "}
            <strong>not</strong> turn two-factor off — if you lose your authenticator app and have
            not kept these codes, nobody can get you back into this account.
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
          disabled={!acknowledged}
          onClick={() => navigate({ to: "/app" })}
          className="btn-primary mt-4 w-full justify-center py-3 disabled:opacity-50"
        >
          Continue <ArrowRight className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[400px]">
      <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-[#0A0C0F]">
        Set up two-factor authentication
      </h2>
      <p className="mt-2 text-[13.5px] leading-[1.6] text-black/55">
        This account has an administrator role, so two-factor authentication is required before you
        can sign in.
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
