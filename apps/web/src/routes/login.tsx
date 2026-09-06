import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowRight, KeyRound, Loader2, ScrollText, ShieldCheck } from "lucide-react";

import { Mark, BrandLockup } from "@/components/soc/marketing/brand";
import { TopologyDiagram } from "@/components/soc/marketing/atmos";
import { displayFont, monoFont } from "@/components/soc/marketing/atmos";
import { ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { MfaEnrolment } from "@/components/soc/mfa-enrolment";

export const Route = createFileRoute("/login")({
  // ?next= carries where the visitor was trying to get to. Without it somebody arriving from
  // a cohort invitation signs in, lands on the dashboard, and has to go back to their email
  // to find the link again.
  validateSearch: (search: Record<string, unknown>): { next?: string } => ({
    next: typeof search.next === "string" ? search.next : undefined,
  }),
  component: LoginPage,
  head: () => ({
    meta: [{ title: "Login — ThreatLens" }, { name: "robots", content: "noindex" }],
  }),
});

const TRUST_LINES = [
  { icon: KeyRound, l: "Secure authentication" },
  { icon: ShieldCheck, l: "Role-based access" },
  { icon: ScrollText, l: "Audit logging" },
];

function LoginPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  // Only same-origin paths. An open redirect here would let an attacker send a ThreatLens
  // login link that bounces the victim to their own site with the session already warm.
  const afterLogin = next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";
  const login = useAuthStore((s) => s.login);
  const completeMfaLogin = useAuthStore((s) => s.completeMfaLogin);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set once login() reports mfaRequired — switches the form to the code-entry step. The
  // server consumes the challenge on the first verify attempt regardless of whether the code
  // was right (see AuthService.mfaVerify), so a wrong code can't just be retried against the
  // same challenge — the error below sends the user back to re-enter their password instead.
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  // Set when a privileged account signs in without MFA enrolled — see MfaEnrolment.
  const [enrolmentChallengeId, setEnrolmentChallengeId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [verifyingMfa, setVerifyingMfa] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await login(email, password);
      if ("mfaEnrolmentRequired" in result) {
        // A privileged account that has never enrolled MFA. It cannot finish signing in until
        // it does, so hand off to the enrolment step rather than reporting a failure.
        setSubmitting(false);
        setEnrolmentChallengeId(result.enrolmentChallengeId);
        return;
      }
      if ("mfaRequired" in result && result.mfaRequired) {
        setSubmitting(false);
        setMfaChallengeId(result.mfaChallengeId);
        return;
      }
      navigate({ to: afterLogin });
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    }
  }

  async function handleMfaSubmit(e: FormEvent) {
    e.preventDefault();
    if (!mfaChallengeId) return;
    setError(null);
    setVerifyingMfa(true);
    try {
      await completeMfaLogin(mfaChallengeId, mfaCode.trim());
      navigate({ to: afterLogin });
    } catch (err) {
      setVerifyingMfa(false);
      setMfaChallengeId(null);
      setMfaCode("");
      setPassword("");
      setError(
        err instanceof ApiError
          ? `${err.message} Please log in again.`
          : "Something went wrong. Please log in again.",
      );
    }
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* left — brand panel */}
      <div
        className="relative hidden flex-col justify-between overflow-hidden p-10 lg:flex xl:p-16"
        style={{ background: "#000000", color: "#EDEDED" }}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-40">
          <TopologyDiagram />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, #000 5%, transparent 40%, transparent 60%, #000 95%)",
          }}
        />

        <Link to="/" className="relative flex items-center gap-2.5" style={displayFont}>
          <Mark />
          <BrandLockup />
        </Link>

        <div className="relative max-w-sm">
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/40" style={monoFont}>
            Security Investigation Platform
          </div>
          <h1
            className="mt-4 text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] text-white xl:text-[32px]"
            style={displayFont}
          >
            Develop practical security investigation skills.
          </h1>
          <p className="mt-3 text-[13.5px] leading-[1.7] text-white/50">
            For individuals and organizations building real investigation capability.
          </p>
        </div>

        <div className="relative flex items-center gap-5">
          {TRUST_LINES.map((t) => (
            <div key={t.l} className="flex items-center gap-1.5 text-[11.5px] text-white/40">
              <t.icon className="size-3.5" />
              {t.l}
            </div>
          ))}
        </div>
      </div>

      {/* right — form panel */}
      <div className="flex min-h-screen flex-col bg-white text-[#0A0C0F]">
        <div className="flex items-center justify-between px-6 py-5 lg:justify-end lg:px-10">
          <Link to="/" className="flex items-center gap-2.5 lg:hidden" style={displayFont}>
            <Mark />
            <span className="text-[15px] font-semibold text-[#0A0C0F]">ThreatLens</span>
          </Link>
          <Link
            to="/signup"
            className="text-[13px] text-black/55 transition-colors hover:text-black"
          >
            Need an account? <span className="font-medium text-[#0A0C0F]">Get Started</span>
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-10">
          {enrolmentChallengeId ? (
            <MfaEnrolment enrolmentChallengeId={enrolmentChallengeId} />
          ) : (
            <div className="w-full max-w-[400px]">
              <h2
                className="text-[24px] font-semibold tracking-[-0.02em] text-[#0A0C0F]"
                style={displayFont}
              >
                {mfaChallengeId ? "Two-factor verification" : "Welcome back"}
              </h2>
              <p className="mt-2 text-[14px] leading-[1.6] text-black/55">
                {mfaChallengeId
                  ? "Enter the 6-digit code from your authenticator app, or one of your recovery codes."
                  : "Access your investigations, training, and progress."}
              </p>

              {mfaChallengeId ? (
                <form className="mt-8 space-y-4" onSubmit={handleMfaSubmit}>
                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-medium text-black/70">
                      Authentication code
                    </span>
                    <input
                      autoFocus
                      required
                      autoComplete="one-time-code"
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value)}
                      placeholder="123456"
                      className="w-full rounded-lg border border-black/15 bg-black/[0.015] px-3.5 py-3 font-mono text-[14px] tracking-widest text-[#0A0C0F] outline-none transition-colors placeholder:text-black/30 focus:border-black/40"
                    />
                  </label>

                  {error && (
                    <p className="rounded-lg border border-[color:var(--critical)]/30 bg-[color:var(--critical)]/5 px-3 py-2 text-[12.5px] text-[color:var(--critical)]">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={verifyingMfa || !mfaCode.trim()}
                    className="btn-primary mt-2 w-full justify-center py-3 disabled:opacity-60"
                  >
                    {verifyingMfa ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" /> Verifying…
                      </>
                    ) : (
                      <>
                        Verify <ArrowRight className="size-3.5" />
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMfaChallengeId(null);
                      setMfaCode("");
                      setError(null);
                    }}
                    className="w-full text-center text-[12.5px] text-black/45 hover:text-black"
                  >
                    Back to login
                  </button>
                </form>
              ) : (
                <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-medium text-black/70">
                      Work email
                    </span>
                    <input
                      type="email"
                      required
                      autoComplete="username"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@organization.com"
                      className="w-full rounded-lg border border-black/15 bg-black/[0.015] px-3.5 py-3 text-[14px] text-[#0A0C0F] outline-none transition-colors placeholder:text-black/30 focus:border-black/40"
                    />
                  </label>
                  <label className="block">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[12px] font-medium text-black/70">Password</span>
                      <Link
                        to="/forgot-password"
                        className="text-[12px] text-black/45 hover:text-black"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <input
                      type="password"
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-black/15 bg-black/[0.015] px-3.5 py-3 text-[14px] text-[#0A0C0F] outline-none transition-colors placeholder:text-black/30 focus:border-black/40"
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
                    className="btn-primary mt-2 w-full justify-center py-3 disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" /> Logging in…
                      </>
                    ) : (
                      <>
                        Log in <ArrowRight className="size-3.5" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-black/8 px-6 py-5 text-[12px] text-black/40">
          <Link to="/privacy" className="hover:text-black/70">
            Privacy Policy
          </Link>
          <Link to="/terms" className="hover:text-black/70">
            Terms of Service
          </Link>
          <Link to="/security" className="hover:text-black/70">
            Security
          </Link>
          <a href="mailto:info@useclickbox.com" className="hover:text-black/70">
            Contact
          </a>
        </div>
      </div>
    </div>
  );
}
