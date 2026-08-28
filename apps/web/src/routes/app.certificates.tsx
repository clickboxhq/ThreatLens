import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { Skeleton, EmptyState } from "@/components/soc/ui/skeleton";
import { IconTile } from "@/components/soc/ui/icon-tile";
import { useCertificates } from "@/hooks/use-certificates";
import { Award, ShieldAlert, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/app/certificates")({
  component: Certs,
  head: () => ({ meta: [{ title: "ThreatLens · Certificates" }] }),
});

function Certs() {
  const { certificates: certs, isPending } = useCertificates();

  if (isPending) {
    return (
      <div className="px-4 py-6 md:px-8 md:py-8">
        <SectionHeader title="Certificates" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Certificates"
        description="Issued once every scenario in a career track clears the pass threshold — verifiable by anyone with the link."
      />
      {certs.length === 0 ? (
        <EmptyState
          title="No certificates yet"
          description="Complete every scenario in a career track's learning path to earn one."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {certs.map((c) => (
            <Panel key={c.id}>
              <div className="flex items-start gap-3">
                <IconTile tone={c.revoked ? "critical" : "info"} size="lg">
                  <Award className="size-6" />
                </IconTile>
                <div className="flex-1">
                  <h3 className="text-[14.5px] font-semibold">{c.learningPathTitle}</h3>
                  <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{c.id}</div>
                  <div className="mt-3 text-[11.5px]">
                    <span className="text-muted-foreground">Issued </span>
                    <span>{new Date(c.issuedAt).toLocaleDateString()}</span>
                  </div>
                  <Link
                    to="/verify/$id"
                    params={{ id: c.id }}
                    target="_blank"
                    className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-[color:var(--info)] hover:opacity-80"
                  >
                    {c.revoked ? (
                      <>
                        <ShieldAlert className="size-3" /> Revoked — view record
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="size-3" /> Public verification link
                      </>
                    )}
                  </Link>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
