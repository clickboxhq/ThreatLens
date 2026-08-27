import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  KeyRound,
  Loader2,
  Mail,
  ScrollText,
  ShieldCheck,
} from "lucide-react";

import { Mark, BrandLockup } from "@/components/soc/marketing/brand";
import { TopologyDiagram } from "@/components/soc/marketing/atmos";
import { displayFont, monoFont } from "@/components/soc/marketing/atmos";
import { apiClient } from "@/lib/api-client";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
  head: () => ({
    meta: [{ title: "Reset password — ThreatLens" }, { name: "robots", content: "noindex" }],
  }),
});

const TRUST_LINES = [
  { icon: KeyRound, l: "Secure authentication" },
  { icon: ShieldCheck, l: "Role-based access" },
  { icon: ScrollText, l: "Audit logging" },
];

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Always resolves the same way whether or not the email matches an account (§15.1
      // anti-enumeration, apps/api/src/modules/auth/auth.service.ts) — there is no error state
      // to handle here even on a real network failure short of a thrown ApiError, which we
      // still don't want to reveal as a distinguishable "no such account" signal.
      await apiClient.post("/auth/password-reset/request", { email });
    } finally {
      setSubmitting(false);
      setSent(true);
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
            to="/login"
            className="text-[13px] text-black/55 transition-colors hover:text-black"
          >
            Remember your password? <span className="font-medium text-[#0A0C0F]">Log in</span>
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-[400px]">
            {sent ? (
              <>
                <div className="mx-auto grid size-12 place-items-center rounded-xl border border-black/10 bg-black/[0.03] text-[#0A0C0F]">
                  <Mail className="size-5" />
                </div>
                <h2
                  className="mt-5 text-center text-[24px] font-semibold tracking-[-0.02em] text-[#0A0C0F]"
                  style={displayFont}
                >
                  Check your email
                </h2>
                <p className="mt-2 text-center text-[14px] leading-[1.6] text-black/55">
                  If an account exists for{" "}
                  <span className="font-medium text-[#0A0C0F]">{email}</span>, we've sent a link to
                  reset your password.
                </p>
                <Link to="/login" className="btn-ghost mt-8 w-full justify-center py-3">
                  <ArrowLeft className="size-3.5" /> Back to login
                </Link>
              </>
            ) : (
              <>
                <h2
                  className="text-[24px] font-semibold tracking-[-0.02em] text-[#0A0C0F]"
                  style={displayFont}
                >
                  Reset your password
                </h2>
                <p className="mt-2 text-[14px] leading-[1.6] text-black/55">
                  Enter your work email and we'll send you a link to reset it.
                </p>

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

                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary mt-2 w-full justify-center py-3 disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" /> Sending…
                      </>
                    ) : (
                      <>
                        Send reset link <ArrowRight className="size-3.5" />
                      </>
                    )}
                  </button>
                </form>

                <Link
                  to="/login"
                  className="mt-6 flex items-center justify-center gap-1.5 text-[13px] text-black/55 transition-colors hover:text-black"
                >
                  <ArrowLeft className="size-3.5" /> Back to login
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
