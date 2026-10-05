/**
 * The ThreatLens Career Track certificate — one reusable document that renders
 * for any track, current or future. Nothing here is hardcoded to a track: name,
 * track, date, id and QR all come from props. Fixed to an A4-landscape canvas
 * (1123 x 794 @ 96dpi) so the on-screen view, the print/PDF output and a shared
 * screenshot are all the same artwork.
 *
 * Render it inside <CertificateFrame> to scale it to fit a container.
 */

export interface CertificateData {
  recipientName: string;
  careerTrackName: string;
  completedAt: string; // ISO
  certificateId: string; // TL-YYYY-XXXXXXXX
  verifyUrl: string;
  qrDataUrl: string;
  status: "active" | "revoked";
}

const NAVY = "#0B1D3A";
const NAVY_SOFT = "#1E3A63";
const BLUE = "#1E6BE6";
const INK = "#0B1D3A";
const PAPER = "#FCFDFF";

const W = 1123;
const H = 794;

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function Mark({ size, light }: { size: number; light?: boolean }) {
  // Approximation of the ThreatLens hex-S mark, drawn so it stays crisp in print.
  const c = light ? "#FFFFFF" : NAVY;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path
        d="M24 3.5 42.7 14v20L24 44.5 5.3 34V14L24 3.5Z"
        fill="none"
        stroke={c}
        strokeWidth="2.4"
        opacity={0.35}
      />
      <path
        d="M33 15c-3-2.4-7-2.9-10.5-2.2-4.4.9-7 3.7-7 7.2 0 3.2 2.2 5.2 6.6 6.3l4 1c2.6.6 3.6 1.4 3.6 2.7 0 1.6-1.8 2.7-4.6 2.7-3 0-5.6-1.1-7.7-3"
        fill="none"
        stroke={c}
        strokeWidth="4.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Feature({ label, sub }: { label: string; sub: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: INK }}>
        {label}
      </span>
      <span style={{ fontSize: 10, letterSpacing: "0.08em", color: NAVY_SOFT }}>{sub}</span>
    </div>
  );
}

export function CertificateDocument({ data }: { data: CertificateData }) {
  const revoked = data.status === "revoked";
  return (
    <div
      style={{
        width: W,
        height: H,
        position: "relative",
        background: PAPER,
        fontFamily: "'Inter', system-ui, sans-serif",
        color: INK,
        overflow: "hidden",
      }}
    >
      {/* topographic texture */}
      <svg
        width={W}
        height={H}
        style={{ position: "absolute", inset: 0, opacity: 0.05 }}
        aria-hidden
      >
        {Array.from({ length: 14 }).map((_, i) => (
          <path
            key={i}
            d={`M0 ${80 + i * 52} C 220 ${40 + i * 52}, 420 ${140 + i * 52}, 700 ${
              70 + i * 52
            } S 1123 ${120 + i * 52}, 1123 ${90 + i * 52}`}
            fill="none"
            stroke={NAVY}
            strokeWidth="1.1"
          />
        ))}
      </svg>

      {/* frame + corner brackets */}
      <div
        style={{
          position: "absolute",
          inset: 16,
          border: `2px solid ${BLUE}`,
          opacity: 0.55,
        }}
      />
      {[
        { top: 10, left: 10, bt: 3, bl: 3 },
        { top: 10, right: 10, bt: 3, br: 3 },
        { bottom: 10, left: 10, bb: 3, bl: 3 },
        { bottom: 10, right: 10, bb: 3, br: 3 },
      ].map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: 34,
            height: 34,
            top: p.top,
            left: p.left,
            right: p.right,
            bottom: p.bottom,
            borderTop: p.bt ? `${p.bt}px solid ${NAVY}` : undefined,
            borderBottom: p.bb ? `${p.bb}px solid ${NAVY}` : undefined,
            borderLeft: p.bl ? `${p.bl}px solid ${NAVY}` : undefined,
            borderRight: p.br ? `${p.br}px solid ${NAVY}` : undefined,
          }}
        />
      ))}

      {/* right pennant banner */}
      <div
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          width: 268,
          height: H - 32,
          background: `linear-gradient(160deg, ${NAVY} 0%, #08152B 100%)`,
          clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% calc(100% - 46px), 0 100%)",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 40,
        }}
      >
        <span style={{ fontSize: 12, letterSpacing: "0.34em", opacity: 0.8 }}>THREATLENS</span>
        <div
          style={{
            marginTop: 30,
            width: 150,
            height: 150,
            borderRadius: "50%",
            border: `2px solid ${BLUE}`,
            display: "grid",
            placeItems: "center",
            position: "relative",
          }}
        >
          {/* laurels */}
          <svg width={150} height={150} style={{ position: "absolute", inset: 0 }} aria-hidden>
            {[-1, 1].map((dir) => (
              <g key={dir} transform={`translate(75 78) scale(${dir} 1)`}>
                {Array.from({ length: 7 }).map((_, i) => (
                  <ellipse
                    key={i}
                    cx={-46}
                    cy={-30 + i * 10}
                    rx={7}
                    ry={3.4}
                    transform={`rotate(${-40 + i * 12} -46 ${-30 + i * 10})`}
                    fill={BLUE}
                    opacity={0.55}
                  />
                ))}
              </g>
            ))}
          </svg>
          <Mark size={62} light />
        </div>
        <div
          style={{
            marginTop: 20,
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          CAREER TRACK
          <br />
          COMPLETION
          <br />
          CERTIFICATE
        </div>
        <div style={{ width: 54, height: 3, background: BLUE, margin: "18px 0" }} />
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.12em",
            textAlign: "center",
            opacity: 0.75,
            lineHeight: 1.7,
          }}
        >
          PRACTICAL SKILLS
          <br />
          FOR A SAFER
          <br />
          TOMORROW
        </div>
      </div>

      {/* left content */}
      <div style={{ position: "absolute", top: 58, left: 68, width: 738 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Mark size={44} />
          <span
            style={{
              fontFamily: "'Space Grotesk', 'Inter', sans-serif",
              fontSize: 40,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: NAVY,
            }}
          >
            Threat<span style={{ color: BLUE }}>Lens</span>
          </span>
        </div>
        <div
          style={{
            marginTop: 6,
            marginLeft: 56,
            fontSize: 11,
            letterSpacing: "0.16em",
            color: NAVY_SOFT,
          }}
        >
          INVESTIGATE&nbsp;&nbsp;/&nbsp;&nbsp;ANALYZE&nbsp;&nbsp;/&nbsp;&nbsp;RESPOND&nbsp;&nbsp;/&nbsp;&nbsp;GROW
        </div>

        <div
          style={{
            marginTop: 40,
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: "0.14em",
            color: NAVY,
          }}
        >
          {revoked ? "CERTIFICATE — REVOKED" : "CERTIFICATE OF COMPLETION"}
        </div>

        <div style={{ marginTop: 18, fontSize: 15, color: NAVY_SOFT }}>This certifies that</div>
        <div
          style={{
            marginTop: 4,
            fontFamily: "'Space Grotesk', 'Inter', sans-serif",
            fontSize: data.recipientName.length > 24 ? 42 : 52,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
            color: NAVY,
          }}
        >
          {data.recipientName}
        </div>

        <div style={{ marginTop: 14, fontSize: 15, color: NAVY_SOFT }}>
          has successfully completed the
        </div>
        <div
          style={{
            marginTop: 4,
            fontFamily: "'Space Grotesk', 'Inter', sans-serif",
            fontSize: data.careerTrackName.length > 30 ? 24 : 28,
            fontWeight: 700,
            lineHeight: 1.15,
            color: NAVY,
          }}
        >
          {data.careerTrackName}
        </div>

        <p
          style={{
            marginTop: 16,
            width: 600,
            fontSize: 13.5,
            lineHeight: 1.7,
            color: NAVY_SOFT,
          }}
        >
          This certificate recognizes the learner&rsquo;s successful completion of the required
          practical investigations and their demonstrated ability to apply cybersecurity
          investigation and analytical skills across realistic incident scenarios.
        </p>

        <div
          style={{
            marginTop: 22,
            display: "flex",
            gap: 34,
            paddingTop: 16,
            borderTop: `1px solid rgba(11,29,58,0.12)`,
          }}
        >
          <Feature label="REAL-WORLD" sub="INVESTIGATIONS" />
          <Feature label="PRACTICAL" sub="ANALYSIS" />
          <Feature label="MITRE ATT&CK" sub="MAPPING" />
          <Feature label="SKILL" sub="VALIDATION" />
        </div>
      </div>

      {/* signature / date / verification row */}
      <div
        style={{
          position: "absolute",
          left: 68,
          bottom: 60,
          right: 320,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 24,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "'Space Grotesk', cursive",
              fontStyle: "italic",
              fontSize: 24,
              color: NAVY,
              borderBottom: `1px solid ${NAVY}`,
              paddingBottom: 4,
              width: 220,
            }}
          >
            The ThreatLens Team
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: NAVY,
            }}
          >
            THE THREATLENS TEAM
          </div>
          <div style={{ fontSize: 9.5, letterSpacing: "0.08em", color: NAVY_SOFT }}>
            CLICKBOX INFORMATION TECHNOLOGY
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 15,
              color: NAVY,
              borderBottom: `1px solid ${NAVY}`,
              paddingBottom: 4,
              minWidth: 160,
            }}
          >
            {fmtDate(data.completedAt)}
          </div>
          <div style={{ marginTop: 6, fontSize: 9.5, letterSpacing: "0.1em", color: NAVY_SOFT }}>
            DATE OF COMPLETION
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img
            src={data.qrDataUrl}
            alt="Verification QR code"
            width={74}
            height={74}
            style={{ display: "block" }}
          />
          <div style={{ fontSize: 9, lineHeight: 1.6, color: NAVY_SOFT }}>
            <div style={{ fontWeight: 700, letterSpacing: "0.06em", color: NAVY }}>
              {data.certificateId}
            </div>
            <div>Verify at</div>
            <div style={{ wordBreak: "break-all" }}>
              {data.verifyUrl.replace(/^https?:\/\//, "")}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          right: 320,
          bottom: 34,
          fontSize: 10,
          letterSpacing: "0.12em",
          color: NAVY_SOFT,
        }}
      >
        SKILLS&nbsp;&nbsp;/&nbsp;&nbsp;PRACTICE&nbsp;&nbsp;/&nbsp;&nbsp;IMPACT
      </div>

      {revoked && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 120,
              fontWeight: 700,
              color: "rgba(200,30,40,0.14)",
              transform: "rotate(-18deg)",
              letterSpacing: "0.1em",
            }}
          >
            REVOKED
          </span>
        </div>
      )}
    </div>
  );
}

/** Scales the fixed-size document to fit its container's width (container-query units). */
export function CertificateFrame({ data }: { data: CertificateData }) {
  return (
    <div
      style={{
        width: "100%",
        aspectRatio: `${W} / ${H}`,
        position: "relative",
        overflow: "hidden",
        borderRadius: 8,
        boxShadow: "0 10px 40px -12px rgba(11,29,58,0.35)",
        containerType: "inline-size",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: W,
          height: H,
          transformOrigin: "top left",
          transform: `scale(calc(100cqw / ${W}))`,
        }}
      >
        <CertificateDocument data={data} />
      </div>
    </div>
  );
}
