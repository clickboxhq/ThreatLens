import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { instructorService } from "@/services/instructor";
import { useIsAuthenticated } from "@/lib/auth-store";
import { ApiError } from "@/lib/api-client";
import { Mark } from "@/components/soc/marketing/brand";
import { displayFont } from "@/components/soc/marketing/atmos";
import { ArrowRight, CheckCircle2, Users } from "lucide-react";

const STAFF_ROLE_LABEL: Record<string, string> = {
  lead: "a lead",
  tutor: "a tutor",
  group_tutor: "a group tutor",
};

export const Route = createFileRoute("/join-cohort/$token")({
  component: JoinCohortPage,
  head: () => ({ meta: [{ title: "Join a cohort · ThreatLens" }] }),
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-white text-black">
      <div className="mx-auto flex min-h-dvh max-w-[440px] flex-col justify-center px-6 py-12">
        <Link to="/" className="mb-8 flex items-center gap-2.5" style={displayFont}>
          <Mark />
          <span className="text-[15px] font-semibold tracking-[-0.02em]">ThreatLens</span>
        </Link>
        {children}
      </div>
    </div>
  );
}

function JoinCohortPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const isAuthenticated = useIsAuthenticated();

  const previewQuery = useQuery({
    queryKey: ["cohort-invite", token],
    queryFn: () => instructorService.previewInvite(token),
    retry: false,
  });

  const accept = useMutation({
    mutationFn: () => instructorService.acceptInvite(token),
    onSuccess: () => navigate({ to: "/app" }),
  });

  const preview = previewQuery.data;

  // Somebody who was already signed in when they clicked, or who has just come back from
  // logging in, should not have to press a second button — they already said yes by opening
  // the link. Only fires for a live invite, so an expired one still explains itself.
  useEffect(() => {
    if (isAuthenticated && preview?.status === "pending" && accept.isIdle) {
      accept.mutate();
    }
  }, [isAuthenticated, preview?.status, accept]);

  if (previewQuery.isPending) {
    return (
      <Shell>
        <div className="h-32 animate-pulse rounded-lg bg-black/5" />
      </Shell>
    );
  }

  if (previewQuery.isError || !preview) {
    return (
      <Shell>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Invitation not found</h1>
        <p className="mt-2 text-[14px] leading-[1.6] text-black/55">
          This link does not match an invitation. It may have been withdrawn, or replaced by a newer
          one sent to the same address.
        </p>
        <Link to="/" className="btn-primary mt-6 w-full justify-center py-3">
          Go to ThreatLens
        </Link>
      </Shell>
    );
  }

  if (preview.status !== "pending") {
    const reason =
      preview.status === "accepted"
        ? "You have already joined this cohort."
        : preview.status === "expired"
          ? "This invitation has expired. Ask your instructor to send another."
          : "This invitation was withdrawn.";
    return (
      <Shell>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{preview.cohortName}</h1>
        <p className="mt-2 text-[14px] leading-[1.6] text-black/55">{reason}</p>
        <Link
          to={preview.status === "accepted" ? "/app" : "/"}
          className="btn-primary mt-6 w-full justify-center py-3"
        >
          {preview.status === "accepted" ? "Open ThreatLens" : "Go to ThreatLens"}
        </Link>
      </Shell>
    );
  }

  // Carries them back here after authenticating, so the invitation is applied without a second
  // trip to their inbox.
  const returnTo = `/join-cohort/${token}`;

  return (
    <Shell>
      <div className="grid size-11 place-items-center rounded-lg bg-black/[0.04]">
        <Users className="size-5" />
      </div>
      <h1 className="mt-5 text-[22px] font-semibold tracking-[-0.02em]">
        {preview.staffRole ? "Teach" : "Join"} {preview.cohortName}
      </h1>
      <p className="mt-2 text-[14px] leading-[1.6] text-black/55">
        <strong>{preview.inviterName}</strong> invited{" "}
        <span className="font-mono text-[13px]">{preview.email}</span>
        {preview.staffRole ? (
          <>
            {" "}
            to teach as <strong>{STAFF_ROLE_LABEL[preview.staffRole] ?? "a tutor"}</strong>
          </>
        ) : preview.groupName ? (
          <>
            {" "}
            to join <strong>{preview.groupName}</strong>
          </>
        ) : null}
        .
      </p>
      {preview.staffRole && !preview.hasAccount && (
        // Saying this before they start matters: a student account cannot accept a teaching
        // invitation, and finding that out after signing up wastes the trip.
        <p className="mt-3 rounded-md bg-black/[0.03] px-3 py-2 text-[12.5px] leading-[1.55] text-black/60">
          Choose the <strong>instructor</strong> account type when you sign up — a student account
          cannot take a teaching role.
        </p>
      )}

      {isAuthenticated ? (
        <div className="mt-6">
          {accept.isError ? (
            <>
              <p className="text-[13px] text-[color:var(--critical)]">
                {accept.error instanceof ApiError
                  ? accept.error.message
                  : "Could not join the cohort. Try again."}
              </p>
              <button
                onClick={() => accept.mutate()}
                className="btn-primary mt-3 w-full justify-center py-3"
              >
                Try again
              </button>
            </>
          ) : (
            <p className="flex items-center gap-2 text-[13px] text-black/55">
              <CheckCircle2 className="size-4" /> Joining {preview.cohortName}…
            </p>
          )}
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          {/* The invite already tells us whether this address has an account, so the page
           * leads with the one action that applies instead of offering both and making the
           * visitor work out which they are. */}
          {preview.hasAccount ? (
            <>
              <Link
                to="/login"
                search={{ next: returnTo }}
                className="btn-primary w-full justify-center py-3"
              >
                Sign in to join <ArrowRight className="size-3.5" />
              </Link>
              <p className="text-center text-[12px] text-black/45">
                Sign in as {preview.email} to accept this invitation.
              </p>
            </>
          ) : (
            <>
              <Link
                to="/signup"
                search={{
                  next: returnTo,
                  email: preview.email,
                  ...(preview.staffRole ? { role: "instructor" } : {}),
                }}
                className="btn-primary w-full justify-center py-3"
              >
                Create your account <ArrowRight className="size-3.5" />
              </Link>
              <Link
                to="/login"
                search={{ next: returnTo }}
                className="w-full rounded-md border border-black/10 py-3 text-center text-[13px] font-medium hover:bg-black/[0.03]"
              >
                I already have an account
              </Link>
            </>
          )}
        </div>
      )}
    </Shell>
  );
}
