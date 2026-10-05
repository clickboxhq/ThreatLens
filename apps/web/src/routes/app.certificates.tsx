import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { Skeleton } from "@/components/soc/ui/skeleton";
import { IconTile } from "@/components/soc/ui/icon-tile";
import { useCertificates, useCareerTrackProgress } from "@/hooks/use-certificates";
import { Award, Download, ShieldAlert, ShieldCheck } from "lucide-react";
import type { CareerTrackProgressDto } from "@/types/threatlens-learning";

export const Route = createFileRoute("/app/certificates")({
  component: Certs,
  head: () => ({ meta: [{ title: "ThreatLens · Certificates" }] }),
});

function Certs() {
  const { certificates, isPending: certsPending } = useCertificates();
  const { tracks, isPending: tracksPending } = useCareerTrackProgress();

  const earnedPublicIds = new Set(certificates.map((c) => c.publicId));
  const inProgress = tracks.filter(
    (t) => !t.certificate || !earnedPublicIds.has(t.certificate.publicId),
  );

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Certificates"
        description="Earn a Career Track certificate by clearing the pass threshold on every scenario in a track. Each one is verifiable by anyone with the link."
      />

      {certsPending ? (
        <Skeleton className="h-32" />
      ) : certificates.length === 0 ? null : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {certificates.map((c) => (
            <Panel key={c.publicId}>
              <div className="flex items-start gap-3">
                <IconTile tone={c.revoked ? "critical" : "info"} size="lg">
                  <Award className="size-6" />
                </IconTile>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[14.5px] font-semibold">{c.careerTrackName}</h3>
                  <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    {c.publicId}
                  </div>
                  <div className="mt-2 text-[11.5px] text-muted-foreground">
                    Issued {new Date(c.issuedAt).toLocaleDateString()}
                    {c.revoked && (
                      <span className="ml-2 text-[color:var(--critical)]">· Revoked</span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-[11px]">
                    <Link
                      to="/app/certificates/$id"
                      params={{ id: c.publicId }}
                      className="inline-flex items-center gap-1.5 text-[color:var(--info)] hover:opacity-80"
                    >
                      <ShieldCheck className="size-3" /> View certificate
                    </Link>
                    <a
                      href={`/certificates/${c.publicId}/print`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-secondary hover:text-foreground"
                    >
                      <Download className="size-3" /> Download PDF
                    </a>
                  </div>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      {!tracksPending && inProgress.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
            In progress
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {inProgress.map((t) => (
              <TrackProgress key={t.courseId} track={t} />
            ))}
          </div>
        </div>
      )}

      {!certsPending && !tracksPending && certificates.length === 0 && inProgress.length === 0 && (
        <Panel className="mt-2">
          <p className="text-[13px] text-muted-foreground">
            No Career Tracks are available yet. Once scenarios are grouped into a track, your
            progress toward a certificate will show here.
          </p>
        </Panel>
      )}
    </div>
  );
}

function TrackProgress({ track }: { track: CareerTrackProgressDto }) {
  const pct =
    track.requiredCount > 0 ? Math.round((track.completedCount / track.requiredCount) * 100) : 0;
  return (
    <Panel>
      <div className="flex items-start gap-3">
        <IconTile tone="neutral" size="lg">
          {track.certificate?.revoked ? (
            <ShieldAlert className="size-6" />
          ) : (
            <Award className="size-6" />
          )}
        </IconTile>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-semibold">{track.careerTrackName}</h3>
          <div className="mt-2 text-[11.5px] text-secondary">
            {track.completedCount} of {track.requiredCount} required investigations completed
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-background">
            <div
              className="h-full rounded-full bg-[color:var(--info)]"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            {track.certificate?.revoked
              ? "Certificate status: Revoked"
              : "Certificate status: Not yet eligible"}
          </div>
        </div>
      </div>
    </Panel>
  );
}
