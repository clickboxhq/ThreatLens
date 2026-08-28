import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Building2, CheckCircle2 } from "lucide-react";

import { Mark, BrandLockup } from "@/components/soc/marketing/brand";
import { TopologyDiagram } from "@/components/soc/marketing/atmos";
import { displayFont, monoFont } from "@/components/soc/marketing/atmos";
import { useIsAuthenticated } from "@/lib/auth-store";
import { useInvitePreview, useAcceptInvite } from "@/hooks/use-organizations";
import { ApiError } from "@/lib/api-client";

function acceptErrorMessage(error: unknown, invitedEmail: string): string {
  if (error instanceof ApiError) {
    if (error.code === "EMAIL_MISMATCH") {
      return `This invite was sent to ${invitedEmail} — log out and sign in with that address to accept.`;
    }
    if (error.code === "ALREADY_IN_ORGANIZATION") {
      return "You already belong to an organization — leave it before joining another.";
    }
    if (error.code === "INVITE_NOT_PENDING") {
      return "This invite is no longer available.";
    }
  }
  return "Couldn't accept that invite — try again.";
}

export const Route = createFileRoute("/accept-invite/$token")({
  component: AcceptInvitePage,
  head: () => ({
    meta: [
      { title: "Join your organization — ThreatLens" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function Shell({ children }: { children: React.ReactNode }) {
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
            Join your team's investigation workspace.
          </h1>
        </div>
        <div aria-hidden className="relative h-4" />
      </div>

      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 py-16 text-[#0A0C0F]">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}

function AcceptInvitePage() {
  const { token } = useParams({ from: "/accept-invite/$token" });
  const navigate = useNavigate();
  const isAuthenticated = useIsAuthenticated();
  const { preview, isPending } = useInvitePreview(token);
  const acceptInvite = useAcceptInvite();

  if (isPending) {
    return (
      <Shell>
        <p className="text-center text-[13px] text-muted-foreground">Checking your invite…</p>
      </Shell>
    );
  }

  if (!preview) {
    return (
      <Shell>
        <div className="text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-xl border border-black/10 bg-black/[0.03] text-black/60">
            <AlertTriangle className="size-5" />
          </div>
          <h2 className="mt-5 text-[22px] font-semibold tracking-[-0.02em]">Invite not found</h2>
          <p className="mt-2 text-[14px] leading-[1.6] text-black/55">
            This invite link is invalid — double-check the link, or ask your organization admin to
            resend it.
          </p>
        </div>
      </Shell>
    );
  }

  if (preview.status !== "pending") {
    const label =
      preview.status === "accepted"
        ? "already been accepted"
        : preview.status === "revoked"
          ? "been revoked"
          : "expired";
    return (
      <Shell>
        <div className="text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-xl border border-black/10 bg-black/[0.03] text-black/60">
            <AlertTriangle className="size-5" />
          </div>
          <h2 className="mt-5 text-[22px] font-semibold tracking-[-0.02em]">
            This invite has {label}
          </h2>
          <p className="mt-2 text-[14px] leading-[1.6] text-black/55">
            Ask {preview.organizationName}'s admin to send a new one.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-xl border border-black/10 bg-black/[0.03] text-[color:var(--info)]">
          <Building2 className="size-5" />
        </div>
        <h2 className="mt-5 text-[22px] font-semibold tracking-[-0.02em]">
          Join {preview.organizationName}
        </h2>
        <p className="mt-2 text-[14px] leading-[1.6] text-black/55">
          You've been invited as a{preview.role === "instructor" ? "n" : ""}{" "}
          <strong>{preview.role}</strong>, to <span className="font-mono">{preview.email}</span>.
        </p>

        {!isAuthenticated ? (
          <div className="mt-6 flex flex-col gap-2">
            <p className="text-[12.5px] text-black/55">
              Log in or create an account with this email to accept.
            </p>
            <Link to="/login" className="btn-primary w-full justify-center py-3">
              Log in <ArrowRight className="size-3.5" />
            </Link>
            <Link
              to="/signup"
              className="w-full rounded-md border border-black/10 py-3 text-center text-[13px] font-medium hover:bg-black/[0.03]"
            >
              Create an account
            </Link>
          </div>
        ) : (
          <div className="mt-6">
            <p className="mb-3 text-[12px] text-black/45">
              Make sure you're signed in as {preview.email} before accepting.
            </p>
            <button
              onClick={() =>
                acceptInvite.mutate(token, { onSuccess: () => navigate({ to: "/app" }) })
              }
              disabled={acceptInvite.isPending}
              className="btn-primary w-full justify-center py-3 disabled:opacity-50"
            >
              {acceptInvite.isPending ? "Joining…" : "Accept & join"}
              <CheckCircle2 className="size-3.5" />
            </button>
            {acceptInvite.isError && (
              <p className="mt-2 text-[12.5px] text-[color:var(--critical)]">
                {acceptErrorMessage(acceptInvite.error, preview.email)}
              </p>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}
