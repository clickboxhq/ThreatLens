import { useEffect } from "react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { usePublicCertificate } from "@/hooks/use-certificates";
import { CertificateDocument } from "@/components/soc/certificate-document";

/**
 * Print / "Save as PDF" surface. The certificate document is laid out at exact
 * A4-landscape and the browser's own PDF export produces a real vector PDF —
 * selectable text, print quality, not a screenshot. Opened in a new tab by the
 * "Download PDF" button; auto-triggers the print dialog.
 */
export const Route = createFileRoute("/certificates/$id/print")({
  component: PrintPage,
  head: () => ({ meta: [{ title: "ThreatLens certificate", name: "robots", content: "noindex" }] }),
});

function PrintPage() {
  const { id } = useParams({ from: "/certificates/$id/print" });
  const { certificate, isPending } = usePublicCertificate(id);

  useEffect(() => {
    if (certificate) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [certificate]);

  if (isPending) {
    return <div style={{ padding: 40, fontFamily: "system-ui" }}>Preparing certificate…</div>;
  }
  if (!certificate) {
    return <div style={{ padding: 40, fontFamily: "system-ui" }}>Certificate not found.</div>;
  }

  return (
    <div className="tl-print-root">
      <style>{`
        @page { size: A4 landscape; margin: 0; }
        html, body { margin: 0; padding: 0; background: #e9edf3; }
        .tl-print-root { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 24px; }
        .tl-print-bar { font-family: system-ui, sans-serif; font-size: 13px; color: #33415c; }
        .tl-print-bar button {
          font: inherit; padding: 8px 16px; border-radius: 8px; border: 0;
          background: #1E6BE6; color: #fff; cursor: pointer;
        }
        @media print {
          html, body { background: #fff; }
          .tl-print-root { padding: 0; gap: 0; }
          .tl-print-bar { display: none; }
          .tl-cert-page { box-shadow: none !important; }
        }
      `}</style>
      <div className="tl-print-bar">
        <button type="button" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </div>
      <div className="tl-cert-page" style={{ boxShadow: "0 10px 40px -12px rgba(11,29,58,0.35)" }}>
        <CertificateDocument data={certificate} />
      </div>
    </div>
  );
}
