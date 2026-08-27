import { createFileRoute, useParams } from "@tanstack/react-router";
import { Award, CheckCircle2, SearchX, ShieldAlert } from "lucide-react";
import { useCertificate } from "@/hooks/use-certificates";

export const Route = createFileRoute("/verify/$id")({
  component: VerifyPage,
  head: () => ({
    meta: [
      { title: "Verify a ThreatLens certificate" },
      {
        name: "description",
        content:
          "Public verification for ThreatLens analyst certificates. Confirms holder, track, score and issue date.",
      },
      { property: "og:title", content: "Verify a ThreatLens certificate" },
      {
        property: "og:description",
        content: "Confirm the authenticity of a ThreatLens certificate of completion.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function VerifyPage() {
  const { id } = useParams({ from: "/verify/$id" });
  const { certificate, isPending } = useCertificate(id);

  if (isPending) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6 py-16">
        <div className="animate-pulse text-[13px] text-muted-foreground">Verifying credential…</div>
      </main>
    );
  }

  if (!certificate) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6 py-16">
        <div className="shadow-elev w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
            <SearchX className="size-6" />
          </div>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Credential not found</h1>
          <p className="mt-1 text-[13px] text-secondary">
            <span className="font-mono">{id}</span> does not match any issued ThreatLens credential.
          </p>
        </div>
      </main>
    );
  }

  const revoked = certificate.verificationStatus === "revoked";

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-16">
      <div className="shadow-elev w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center">
        <div
          className="mx-auto grid size-12 place-items-center rounded-xl"
          style={{
            background: revoked
              ? "color-mix(in oklab, var(--critical) 15%, transparent)"
              : "color-mix(in oklab, var(--info) 15%, transparent)",
            color: revoked ? "var(--critical)" : "var(--info)",
          }}
        >
          {revoked ? <ShieldAlert className="size-6" /> : <Award className="size-6" />}
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">
          {revoked ? "Certificate revoked" : "Certificate verified"}
        </h1>
        <p className="mt-1 text-[13px] text-secondary">
          {revoked
            ? "This credential was issued by ThreatLens but has since been revoked."
            : "This credential was issued by ThreatLens and has not been revoked."}
        </p>

        <dl className="mt-6 divide-y divide-border rounded-xl border border-border bg-background text-left text-[12.5px]">
          {[
            ["Credential ID", certificate.id],
            ["Holder", certificate.holder],
            ["Track", certificate.name],
            ["Score", certificate.score],
            ["Issued", certificate.issued],
            ["Status", revoked ? "Revoked" : "Active"],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4 px-4 py-2.5">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="truncate font-mono">{v}</dd>
            </div>
          ))}
        </dl>

        {!revoked && (
          <p className="mt-4 inline-flex items-center gap-1.5 text-[11.5px] text-secondary">
            <CheckCircle2 className="size-3.5 text-[color:var(--success)]" /> Minimal-PII public
            record
          </p>
        )}
      </div>
    </main>
  );
}
