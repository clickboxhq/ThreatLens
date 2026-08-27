import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, CheckCircle2, MailCheck } from "lucide-react";

import { Mark, BrandLockup } from "@/components/soc/marketing/brand";
import { TopologyDiagram } from "@/components/soc/marketing/atmos";
import { displayFont, monoFont } from "@/components/soc/marketing/atmos";

export const Route = createFileRoute("/verify-email/$token")({
  component: VerifyEmailPage,
  head: () => ({
    meta: [{ title: "Verify your email — ThreatLens" }, { name: "robots", content: "noindex" }],
  }),
});

/**
 * Mock-only token status — see reset-password.$token.tsx for the same
 * pattern. Try /verify-email/expired or /verify-email/already-verified.
 */
function tokenStatus(token: string): "valid" | "expired" | "already-verified" {
  if (token === "expired") return "expired";
  if (token === "already-verified") return "already-verified";
  return "valid";
}

function VerifyEmailPage() {
  const { token } = useParams({ from: "/verify-email/$token" });
  const status = tokenStatus(token);

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
        <div aria-hidden className="relative h-4" />
      </div>

      <div className="flex min-h-screen flex-col bg-white text-[#0A0C0F]">
        <div className="flex items-center justify-between px-6 py-5 lg:justify-end lg:px-10">
          <Link to="/" className="flex items-center gap-2.5 lg:hidden" style={displayFont}>
            <Mark />
            <span className="text-[15px] font-semibold text-[#0A0C0F]">ThreatLens</span>
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-[400px] text-center">
            {status === "valid" && (
              <>
                <div className="mx-auto grid size-12 place-items-center rounded-xl border border-black/10 bg-black/[0.03] text-[color:var(--success)]">
                  <CheckCircle2 className="size-5" />
                </div>
                <h2
                  className="mt-5 text-[24px] font-semibold tracking-[-0.02em] text-[#0A0C0F]"
                  style={displayFont}
                >
                  Email verified
                </h2>
                <p className="mt-2 text-[14px] leading-[1.6] text-black/55">
                  Your email address has been confirmed. You're ready to start investigating.
                </p>
                <Link to="/app" className="btn-primary mt-8 w-full justify-center py-3">
                  Continue to ThreatLens <ArrowRight className="size-3.5" />
                </Link>
              </>
            )}
            {status === "already-verified" && (
              <>
                <div className="mx-auto grid size-12 place-items-center rounded-xl border border-black/10 bg-black/[0.03] text-[color:var(--info)]">
                  <MailCheck className="size-5" />
                </div>
                <h2
                  className="mt-5 text-[24px] font-semibold tracking-[-0.02em] text-[#0A0C0F]"
                  style={displayFont}
                >
                  Already verified
                </h2>
                <p className="mt-2 text-[14px] leading-[1.6] text-black/55">
                  This email address was already confirmed. You can log in normally.
                </p>
                <Link to="/login" className="btn-primary mt-8 w-full justify-center py-3">
                  Go to login <ArrowRight className="size-3.5" />
                </Link>
              </>
            )}
            {status === "expired" && (
              <>
                <div className="mx-auto grid size-12 place-items-center rounded-xl border border-black/10 bg-black/[0.03] text-[color:var(--critical)]">
                  <AlertTriangle className="size-5" />
                </div>
                <h2
                  className="mt-5 text-[24px] font-semibold tracking-[-0.02em] text-[#0A0C0F]"
                  style={displayFont}
                >
                  This link has expired
                </h2>
                <p className="mt-2 text-[14px] leading-[1.6] text-black/55">
                  Verification links are valid for 24 hours. Log in to request a new one.
                </p>
                <Link to="/login" className="btn-primary mt-8 w-full justify-center py-3">
                  Go to login <ArrowRight className="size-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
