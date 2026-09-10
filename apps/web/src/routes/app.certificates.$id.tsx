import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, Download, ExternalLink, ShieldCheck } from "lucide-react";
import { Skeleton, EmptyState } from "@/components/soc/ui/skeleton";
import { useMyCertificate } from "@/hooks/use-certificates";
import { CertificateFrame } from "@/components/soc/certificate-document";

export const Route = createFileRoute("/app/certificates/$id")({
  component: CertificateView,
  head: () => ({ meta: [{ title: "ThreatLens · Certificate" }] }),
});

function CertificateView() {
  const { id } = useParams({ from: "/app/certificates/$id" });
  const { certificate, isPending } = useMyCertificate(id);

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <Link
        to="/app/certificates"
        className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-secondary hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> All certificates
      </Link>

      {isPending ? (
        <Skeleton className="h-[420px] max-w-4xl" />
      ) : !certificate ? (
        <EmptyState
          title="Certificate not found"
          description="This certificate doesn't exist, or it isn't yours."
        />
      ) : (
        <div className="max-w-4xl">
          <CertificateFrame data={certificate} />

          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <a
              href={`/certificates/${certificate.certificateId}/print`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover"
            >
              <Download className="size-3.5" /> Download PDF
            </a>
            <Link
              to="/verify/$id"
              params={{ id: certificate.certificateId }}
              target="_blank"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-4 text-[12px] text-secondary hover:text-foreground"
            >
              <ShieldCheck className="size-3.5" /> Public verification page
            </Link>
            <a
              href={certificate.verifyUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-4 text-[12px] text-secondary hover:text-foreground"
            >
              <ExternalLink className="size-3.5" /> Copy-ready link
            </a>
          </div>

          <p className="mt-3 font-mono text-[11px] text-muted-foreground">
            {certificate.certificateId} · verify at{" "}
            {certificate.verifyUrl.replace(/^https?:\/\//, "")}
          </p>
        </div>
      )}
    </div>
  );
}
