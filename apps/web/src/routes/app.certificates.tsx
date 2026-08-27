import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { IconTile } from "@/components/soc/ui/icon-tile";
import { useCertificates } from "@/hooks/use-certificates";
import { Award, Download, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/app/certificates")({
  component: Certs,
  head: () => ({ meta: [{ title: "ThreatLens · Certificates" }] }),
});

function Certs() {
  const { certificates: certs } = useCertificates();
  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Certificates"
        description="Verifiable, tamper-evident credentials for completed programs."
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {certs.map((c) => (
          <Panel key={c.id}>
            <div className="flex items-start gap-3">
              <IconTile tone="info" size="lg">
                <Award className="size-6" />
              </IconTile>
              <div className="flex-1">
                <h3 className="text-[14.5px] font-semibold">{c.name}</h3>
                <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{c.id}</div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11.5px]">
                  <div>
                    <span className="text-muted-foreground">Issued </span>
                    <span>{c.issued}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Expires </span>
                    <span>{c.expires}</span>
                  </div>
                </div>
                <Link
                  to={c.verifyUrl}
                  target="_blank"
                  className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-[color:var(--info)] hover:opacity-80"
                >
                  <ShieldCheck className="size-3" /> Public verification link
                </Link>
              </div>
              <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-[11.5px] text-secondary">
                <Download className="size-3.5" /> PDF
              </button>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
