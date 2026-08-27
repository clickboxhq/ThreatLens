import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Building2, CheckCircle2 } from "lucide-react";

import { Mark, BrandLockup } from "@/components/soc/marketing/brand";
import { TopologyDiagram } from "@/components/soc/marketing/atmos";
import { displayFont, monoFont } from "@/components/soc/marketing/atmos";
import { useAccount } from "@/hooks/use-account";

export const Route = createFileRoute("/accept-invite/$token")({
  component: AcceptInvitePage,
  head: () => ({
    meta: [
      { title: "Join your organization — ThreatLens" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

/**
 * Mock-only token status + inviting org — a real backend would resolve
 * the token to an actual pending invitation record (org name, inviter,
 * role). Try /accept-invite/expired or /accept-invite/accepted.
 */
function inviteFromToken(token: string): {
  status: "valid" | "expired" | "accepted";
  orgName: string;
} {
  if (token === "expired") return { status: "expired", orgName: "Contoso University" };
  if (token === "accepted") return { status: "accepted", orgName: "Contoso University" };
  return { status: "valid", orgName: "Contoso University" };
}

function AcceptInvitePage() {
  const { token } = useParams({ from: "/accept-invite/$token" });
  const navigate = useNavigate();
  const { setAccountType } = useAccount();
  const invite = inviteFromToken(token);

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
            Build practical security investigation skills, together.
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
            {invite.status === "expired" && (
              <>
                <div className="mx-auto grid size-12 place-items-center rounded-xl border border-black/10 bg-black/[0.03] text-[color:var(--critical)]">
                  <AlertTriangle className="size-5" />
                </div>
                <h2
                  className="mt-5 text-[24px] font-semibold tracking-[-0.02em] text-[#0A0C0F]"
                  style={displayFont}
                >
                  This invitation has expired
                </h2>
                <p className="mt-2 text-[14px] leading-[1.6] text-black/55">
                  Ask an administrator at {invite.orgName} to send you a new invitation.
                </p>
                <Link to="/login" className="btn-primary mt-8 w-full justify-center py-3">
                  Go to login <ArrowRight className="size-3.5" />
                </Link>
              </>
            )}
            {invite.status === "accepted" && (
              <>
                <div className="mx-auto grid size-12 place-items-center rounded-xl border border-black/10 bg-black/[0.03] text-[color:var(--info)]">
                  <CheckCircle2 className="size-5" />
                </div>
                <h2
                  className="mt-5 text-[24px] font-semibold tracking-[-0.02em] text-[#0A0C0F]"
                  style={displayFont}
                >
                  Invitation already accepted
                </h2>
                <p className="mt-2 text-[14px] leading-[1.6] text-black/55">
                  You've already joined {invite.orgName}. Log in to continue.
                </p>
                <Link to="/login" className="btn-primary mt-8 w-full justify-center py-3">
                  Go to login <ArrowRight className="size-3.5" />
                </Link>
              </>
            )}
            {invite.status === "valid" && (
              <>
                <div className="mx-auto grid size-12 place-items-center rounded-xl border border-black/10 bg-black/[0.03] text-[#0A0C0F]">
                  <Building2 className="size-5" />
                </div>
                <h2
                  className="mt-5 text-[24px] font-semibold tracking-[-0.02em] text-[#0A0C0F]"
                  style={displayFont}
                >
                  Join {invite.orgName}
                </h2>
                <p className="mt-2 text-[14px] leading-[1.6] text-black/55">
                  You've been invited to join {invite.orgName} on ThreatLens as an analyst.
                </p>
                <button
                  onClick={() => {
                    setAccountType("organization", invite.orgName);
                    navigate({ to: "/welcome" });
                  }}
                  className="btn-primary mt-8 w-full justify-center py-3"
                >
                  Accept invitation <ArrowRight className="size-3.5" />
                </button>
                <p className="mt-4 text-[12px] text-black/45">
                  Not expecting this? You can safely ignore it.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
