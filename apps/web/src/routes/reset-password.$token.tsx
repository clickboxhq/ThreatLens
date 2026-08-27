import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  ScrollText,
  ShieldCheck,
} from "lucide-react";

import { Mark, BrandLockup } from "@/components/soc/marketing/brand";
import { TopologyDiagram } from "@/components/soc/marketing/atmos";
import { displayFont, monoFont } from "@/components/soc/marketing/atmos";

export const Route = createFileRoute("/reset-password/$token")({
  component: ResetPasswordPage,
  head: () => ({
    meta: [{ title: "Reset password — ThreatLens" }, { name: "robots", content: "noindex" }],
  }),
});

const TRUST_LINES = [
  { icon: KeyRound, l: "Secure authentication" },
  { icon: ShieldCheck, l: "Role-based access" },
  { icon: ScrollText, l: "Audit logging" },
];

/**
 * Mock-only token status derivation. A real backend would return this as
 * part of the token-validation response (see BACKEND_INTEGRATION.md) —
 * here it's simulated from the token value so every state is reachable
 * for testing: try /reset-password/expired or /reset-password/used.
 */
function tokenStatus(token: string): "valid" | "expired" | "used" {
  if (token === "expired") return "expired";
  if (token === "used") return "used";
  return "valid";
}

function ResetPasswordPage() {
  const { token } = useParams({ from: "/reset-password/$token" });
  const navigate = useNavigate();
  const status = tokenStatus(token);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
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
            Back to <span className="font-medium text-[#0A0C0F]">login</span>
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-[400px]">
            {status !== "valid" ? (
              <>
                <div className="mx-auto grid size-12 place-items-center rounded-xl border border-black/10 bg-black/[0.03] text-[color:var(--critical)]">
                  <AlertTriangle className="size-5" />
                </div>
                <h2
                  className="mt-5 text-center text-[24px] font-semibold tracking-[-0.02em] text-[#0A0C0F]"
                  style={displayFont}
                >
                  {status === "expired" ? "This link has expired" : "This link was already used"}
                </h2>
                <p className="mt-2 text-center text-[14px] leading-[1.6] text-black/55">
                  {status === "expired"
                    ? "Password reset links are valid for 60 minutes. Request a new one to continue."
                    : "This reset link has already been used to set a new password. Request a new one if you need to reset it again."}
                </p>
                <Link to="/forgot-password" className="btn-primary mt-8 w-full justify-center py-3">
                  Request a new link <ArrowRight className="size-3.5" />
                </Link>
              </>
            ) : done ? (
              <>
                <div className="mx-auto grid size-12 place-items-center rounded-xl border border-black/10 bg-black/[0.03] text-[color:var(--success)]">
                  <CheckCircle2 className="size-5" />
                </div>
                <h2
                  className="mt-5 text-center text-[24px] font-semibold tracking-[-0.02em] text-[#0A0C0F]"
                  style={displayFont}
                >
                  Password updated
                </h2>
                <p className="mt-2 text-center text-[14px] leading-[1.6] text-black/55">
                  Your password has been reset. You can now log in with your new password.
                </p>
                <button
                  onClick={() => navigate({ to: "/login" })}
                  className="btn-primary mt-8 w-full justify-center py-3"
                >
                  Continue to login <ArrowRight className="size-3.5" />
                </button>
              </>
            ) : (
              <>
                <h2
                  className="text-[24px] font-semibold tracking-[-0.02em] text-[#0A0C0F]"
                  style={displayFont}
                >
                  Set a new password
                </h2>
                <p className="mt-2 text-[14px] leading-[1.6] text-black/55">
                  Choose a strong password you haven't used before.
                </p>

                <form
                  className="mt-8 space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (password.length < 8)
                      return setError("Password must be at least 8 characters.");
                    if (password !== confirm) return setError("Passwords do not match.");
                    setError(null);
                    setDone(true);
                  }}
                >
                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-medium text-black/70">
                      New password
                    </span>
                    <input
                      type="password"
                      required
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-black/15 bg-black/[0.015] px-3.5 py-3 text-[14px] text-[#0A0C0F] outline-none transition-colors placeholder:text-black/30 focus:border-black/40"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-medium text-black/70">
                      Confirm password
                    </span>
                    <input
                      type="password"
                      required
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-black/15 bg-black/[0.015] px-3.5 py-3 text-[14px] text-[#0A0C0F] outline-none transition-colors placeholder:text-black/30 focus:border-black/40"
                    />
                  </label>

                  {error && (
                    <p className="rounded-lg border border-[color:var(--critical)]/30 bg-[color:var(--critical)]/5 px-3 py-2 text-[12.5px] text-[color:var(--critical)]">
                      {error}
                    </p>
                  )}

                  <button type="submit" className="btn-primary mt-2 w-full justify-center py-3">
                    Set new password <ArrowRight className="size-3.5" />
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
