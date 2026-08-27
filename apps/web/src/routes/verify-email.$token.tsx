import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

import { Mark, BrandLockup } from "@/components/soc/marketing/brand";
import { TopologyDiagram } from "@/components/soc/marketing/atmos";
import { displayFont, monoFont } from "@/components/soc/marketing/atmos";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";

export const Route = createFileRoute("/verify-email/$token")({
  component: VerifyEmailPage,
  head: () => ({
    meta: [{ title: "Verify your email — ThreatLens" }, { name: "robots", content: "noindex" }],
  }),
});

// SOCVerse's confirm endpoint (apps/api/src/modules/auth/auth.service.ts's
// confirmEmailVerification) doesn't distinguish "expired" from "already verified" — an invalid
// token is just an invalid token, so this page only has three real states: checking, verified,
// or failed (grouping the original mock's separate "expired"/"already-verified" outcomes).
type Status = "checking" | "verified" | "failed";

function VerifyEmailPage() {
  const { token } = useParams({ from: "/verify-email/$token" });
  const markEmailVerified = useAuthStore((s) => s.markEmailVerified);
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let cancelled = false;
    apiClient
      .post("/auth/email-verification/confirm", { token })
      .then(() => {
        if (cancelled) return;
        markEmailVerified();
        setStatus("verified");
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });
    return () => {
      cancelled = true;
    };
  }, [token, markEmailVerified]);

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
            {status === "checking" && (
              <>
                <div className="mx-auto grid size-12 place-items-center rounded-xl border border-black/10 bg-black/[0.03] text-black/60">
                  <Loader2 className="size-5 animate-spin" />
                </div>
                <h2
                  className="mt-5 text-[24px] font-semibold tracking-[-0.02em] text-[#0A0C0F]"
                  style={displayFont}
                >
                  Confirming your email…
                </h2>
              </>
            )}
            {status === "verified" && (
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
            {status === "failed" && (
              <>
                <div className="mx-auto grid size-12 place-items-center rounded-xl border border-black/10 bg-black/[0.03] text-[color:var(--critical)]">
                  <AlertTriangle className="size-5" />
                </div>
                <h2
                  className="mt-5 text-[24px] font-semibold tracking-[-0.02em] text-[#0A0C0F]"
                  style={displayFont}
                >
                  This link is invalid or has expired
                </h2>
                <p className="mt-2 text-[14px] leading-[1.6] text-black/55">
                  Verification links expire after a while and can only be used once. Log in and
                  we'll send you a new one.
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
