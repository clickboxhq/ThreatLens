import { createFileRoute, useParams } from "@tanstack/react-router";
import { CheckCircle2, SearchX, ShieldAlert } from "lucide-react";
import { usePublicCertificate } from "@/hooks/use-certificates";
import { CertificateFrame } from "@/components/soc/certificate-document";

export const Route = createFileRoute("/verify/$id")({
  component: VerifyPage,
  head: () => ({
    meta: [
      { title: "Verify a ThreatLens certificate" },
      {
        name: "description",
        content:
          "Public verification for ThreatLens Career Track certificates. Confirms the recipient, track, and issue date.",
      },
      { property: "og:title", content: "Verify a ThreatLens certificate" },
      {
        property: "og:description",
        content: "Confirm the authenticity of a ThreatLens Career Track certificate.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function VerifyPage() {
  const { id } = useParams({ from: "/verify/$id" });
  const { certificate, isPending } = usePublicCertificate(id);

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
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Certificate not found</h1>
          <p className="mt-1 text-[13px] text-secondary">
            <span className="font-mono">{id}</span> does not match any certificate issued by
            ThreatLens.
          </p>
        </div>
      </main>
    );
  }

  const revoked = certificate.status === "revoked";

  return (
    <main className="min-h-screen bg-background px-4 py-10 md:px-6">
      <div className="mx-auto max-w-4xl">
        <div
          className="flex items-center gap-3 rounded-xl border p-4"
          style={{
            borderColor: revoked
              ? "color-mix(in oklab, var(--critical) 40%, transparent)"
              : "color-mix(in oklab, var(--success) 40%, transparent)",
            background: revoked
              ? "color-mix(in oklab, var(--critical) 8%, transparent)"
              : "color-mix(in oklab, var(--success) 8%, transparent)",
          }}
        >
          <div
            className="grid size-10 shrink-0 place-items-center rounded-lg"
            style={{
              background: revoked
                ? "color-mix(in oklab, var(--critical) 16%, transparent)"
                : "color-mix(in oklab, var(--success) 16%, transparent)",
              color: revoked ? "var(--critical)" : "var(--success)",
            }}
          >
            {revoked ? <ShieldAlert className="size-5" /> : <CheckCircle2 className="size-5" />}
          </div>
          <div>
            <h1 className="text-[15px] font-semibold">
              {revoked ? "Certificate revoked" : "Certificate verified"}
            </h1>
            <p className="text-[12.5px] text-secondary">
              {revoked
                ? "This certificate was issued by ThreatLens but has since been revoked."
                : "This is an authentic certificate issued by ThreatLens."}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <CertificateFrame data={certificate} />
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-3 rounded-xl border border-border bg-card p-5 text-[12.5px] sm:grid-cols-3">
          {[
            ["Recipient", certificate.recipientName],
            ["Career Track", certificate.careerTrackName],
            ["Date completed", new Date(certificate.completedAt).toLocaleDateString()],
            ["Certificate ID", certificate.certificateId],
            ["Status", revoked ? "Revoked" : "Active"],
            ["Issued by", "ThreatLens by ClickBox Information Technology"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{k}</dt>
              <dd className="mt-0.5 font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </main>
  );
}
