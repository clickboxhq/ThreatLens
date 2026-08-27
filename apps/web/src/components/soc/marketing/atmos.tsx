/**
 * ClickBox atmospheric technical artwork.
 *
 * A small library of blueprint-style SVG layers used as environment rather
 * than decoration: they bleed past containers, fade into the black, and sit
 * behind typography. Everything is monochrome + a single restrained accent
 * pulled from --primary, so the whole page reads as one visual system.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

/* -------------------------------------------------------------- tokens */

export const displayFont = {
  fontFamily: '"Space Grotesk", "Inter", system-ui, sans-serif',
};
export const monoFont = {
  fontFamily: '"Geist Mono", "JetBrains Mono", monospace',
};

/* ------------------------------------------------------------- reveal */

export function Reveal({
  children,
  delay = 0,
  y = 18,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setSeen(true);
            io.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: seen ? 1 : 0,
        transform: seen ? "none" : `translateY(${y}px)`,
        filter: seen ? "none" : "blur(6px)",
        transition:
          "opacity 700ms cubic-bezier(.22,1,.36,1), transform 700ms cubic-bezier(.22,1,.36,1), filter 700ms cubic-bezier(.22,1,.36,1)",
        transitionDelay: `${delay}ms`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------ section typography */

export function Eyebrow({
  children,
  tone = "dark",
}: {
  children: ReactNode;
  tone?: "dark" | "light";
}) {
  return (
    <div
      className={`inline-flex items-center gap-2.5 text-[10.5px] font-medium uppercase tracking-[0.22em] ${
        tone === "light" ? "text-black/50" : "text-white/45"
      }`}
      style={monoFont}
    >
      <span
        className="h-px w-6"
        style={{
          background:
            "linear-gradient(90deg, transparent, color-mix(in oklab, var(--primary) 80%, transparent))",
        }}
      />
      {children}
    </div>
  );
}

export function SectionHead({
  eyebrow,
  title,
  sub,
  align = "left",
  max = "max-w-2xl",
  tone = "dark",
}: {
  eyebrow: string;
  title: ReactNode;
  sub?: ReactNode;
  align?: "left" | "center";
  max?: string;
  tone?: "dark" | "light";
}) {
  return (
    <Reveal className={align === "center" ? `mx-auto ${max} text-center` : `${max}`}>
      <Eyebrow tone={tone}>{eyebrow}</Eyebrow>
      <h2
        className={`mt-4 text-[30px] font-semibold leading-[1.06] tracking-[-0.03em] md:text-[46px] ${
          tone === "light" ? "text-[#0A0C0F]" : "text-white"
        }`}
        style={displayFont}
      >
        {title}
      </h2>
      {sub && (
        <p
          className={`mt-5 max-w-xl text-[14.5px] leading-[1.65] [text-wrap:pretty] ${
            tone === "light" ? "text-black/55" : "text-white/55"
          }`}
        >
          {sub}
        </p>
      )}
    </Reveal>
  );
}

/* ------------------------------------------------------------ layers */

/** Fine blueprint grid that dissolves toward the edges. */
export function GridField({
  className = "",
  size = 44,
  opacity = 0.085,
  tone = "dark",
}: {
  className?: string;
  size?: number;
  opacity?: number;
  tone?: "dark" | "light";
}) {
  const lineColor = tone === "light" ? "rgba(10,12,15,.5)" : "rgba(255,255,255,.55)";
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{
        opacity,
        backgroundImage: `linear-gradient(${lineColor} 1px, transparent 1px), linear-gradient(90deg, ${lineColor} 1px, transparent 1px)`,
        backgroundSize: `${size}px ${size}px`,
        maskImage: "radial-gradient(ellipse 75% 65% at 50% 40%, black, transparent 78%)",
        WebkitMaskImage: "radial-gradient(ellipse 75% 65% at 50% 40%, black, transparent 78%)",
      }}
    />
  );
}

/** Soft atmospheric bloom. Very low intensity by design. */
export function Bloom({
  className = "",
  intensity = 0.14,
}: {
  className?: string;
  intensity?: number;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute ${className}`}
      style={{
        background: `radial-gradient(ellipse at center, color-mix(in oklab, var(--primary) ${Math.round(
          intensity * 100,
        )}%, transparent) 0%, transparent 68%)`,
        filter: "blur(40px)",
      }}
    />
  );
}

/** Telemetry entering the platform: many faint streams converging. */
export function SignalStreams({ className = "" }: { className?: string }) {
  const lines = Array.from({ length: 26 }, (_, i) => i);
  return (
    <svg
      aria-hidden
      viewBox="0 0 1200 420"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="cb-stream" x1="0" x2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0)" />
          <stop offset="38%" stopColor="rgba(255,255,255,.5)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <radialGradient id="cb-core" cx="50%" cy="50%">
          <stop offset="0%" stopColor="color-mix(in oklab, var(--primary) 85%, transparent)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>
      {lines.map((i) => {
        const y = 12 + i * 15.5;
        return (
          <path
            key={i}
            d={`M -20 ${y} C 320 ${y}, 480 210, 900 210`}
            fill="none"
            stroke="url(#cb-stream)"
            strokeWidth={i % 5 === 0 ? 1.1 : 0.6}
            strokeDasharray={i % 3 === 0 ? "2 8" : undefined}
            opacity={0.5 + (i % 4) * 0.1}
          >
            {i % 4 === 0 && (
              <animate
                attributeName="stroke-dashoffset"
                values="0;-60"
                dur={`${6 + (i % 5)}s`}
                repeatCount="indefinite"
              />
            )}
          </path>
        );
      })}
      <circle cx="900" cy="210" r="120" fill="url(#cb-core)" opacity="0.5" />
      <circle
        cx="900"
        cy="210"
        r="46"
        fill="none"
        stroke="rgba(255,255,255,.35)"
        strokeWidth="0.8"
      />
      <circle
        cx="900"
        cy="210"
        r="74"
        fill="none"
        stroke="rgba(255,255,255,.16)"
        strokeWidth="0.8"
        strokeDasharray="3 7"
      />
    </svg>
  );
}

/** Identity / endpoint / email / cloud / network correlation topology. */
export function TopologyDiagram({ className = "" }: { className?: string }) {
  const nodes = [
    { x: 120, y: 90, l: "IDENTITY" },
    { x: 640, y: 60, l: "ENDPOINT" },
    { x: 100, y: 320, l: "EMAIL" },
    { x: 660, y: 350, l: "CLOUD" },
    { x: 380, y: 415, l: "NETWORK" },
  ];
  return (
    <svg
      aria-hidden
      viewBox="0 0 760 470"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    >
      <g stroke="rgba(255,255,255,.2)" strokeWidth="0.8" fill="none">
        {nodes.map((n, i) => (
          <line key={i} x1={n.x} y1={n.y} x2={380} y2={230} strokeDasharray="3 6">
            <animate
              attributeName="stroke-dashoffset"
              values="0;-36"
              dur={`${5 + i}s`}
              repeatCount="indefinite"
            />
          </line>
        ))}
        {nodes.map((n, i) => {
          const m = nodes[(i + 1) % nodes.length];
          return (
            <path key={`r${i}`} d={`M ${n.x} ${n.y} Q 380 230 ${m.x} ${m.y}`} opacity="0.28" />
          );
        })}
      </g>

      <circle cx="380" cy="230" r="96" fill="none" stroke="rgba(255,255,255,.1)" />
      <circle
        cx="380"
        cy="230"
        r="62"
        fill="none"
        stroke="color-mix(in oklab, var(--primary) 60%, transparent)"
        strokeWidth="0.9"
      />
      <circle
        cx="380"
        cy="230"
        r="30"
        fill="color-mix(in oklab, var(--primary) 18%, transparent)"
        stroke="color-mix(in oklab, var(--primary) 85%, transparent)"
        strokeWidth="1"
      />
      <text
        x="380"
        y="228"
        textAnchor="middle"
        fill="#fff"
        fontSize="9"
        letterSpacing="1.6"
        fontFamily='"Geist Mono", monospace'
      >
        CASE
      </text>
      <text
        x="380"
        y="239"
        textAnchor="middle"
        fill="rgba(255,255,255,.6)"
        fontSize="7"
        letterSpacing="1.4"
        fontFamily='"Geist Mono", monospace'
      >
        GRAPH
      </text>

      {nodes.map((n) => (
        <g key={n.l}>
          <rect
            x={n.x - 46}
            y={n.y - 13}
            width="92"
            height="26"
            rx="5"
            fill="rgba(10,12,14,.85)"
            stroke="rgba(255,255,255,.14)"
          />
          <text
            x={n.x}
            y={n.y + 4}
            textAnchor="middle"
            fill="rgba(255,255,255,.72)"
            fontSize="8.5"
            letterSpacing="1.4"
            fontFamily='"Geist Mono", monospace'
          >
            {n.l}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** Evidence / reasoning graph — nodes progressively "assemble". */
export function EvidenceGraph({ className = "" }: { className?: string }) {
  const pts = [
    [40, 210],
    [150, 120],
    [160, 300],
    [280, 70],
    [300, 210],
    [290, 350],
    [420, 140],
    [430, 280],
    [560, 210],
  ];
  const edges: [number, number][] = [
    [0, 1],
    [0, 2],
    [1, 3],
    [1, 4],
    [2, 4],
    [2, 5],
    [3, 6],
    [4, 6],
    [4, 7],
    [5, 7],
    [6, 8],
    [7, 8],
  ];
  return (
    <svg
      aria-hidden
      viewBox="0 0 620 420"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    >
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={pts[a][0]}
          y1={pts[a][1]}
          x2={pts[b][0]}
          y2={pts[b][1]}
          stroke="rgba(255,255,255,.18)"
          strokeWidth="0.8"
          strokeDasharray="140"
          strokeDashoffset="140"
        >
          <animate
            attributeName="stroke-dashoffset"
            from="140"
            to="0"
            dur="1.4s"
            begin={`${i * 0.12}s`}
            fill="freeze"
          />
        </line>
      ))}
      {pts.map(([x, y], i) => (
        <g key={i}>
          <circle
            cx={x}
            cy={y}
            r={i === 8 ? 9 : 4}
            fill={
              i === 8
                ? "color-mix(in oklab, var(--primary) 80%, transparent)"
                : "rgba(255,255,255,.75)"
            }
            opacity="0"
          >
            <animate
              attributeName="opacity"
              from="0"
              to={i === 8 ? "1" : "0.8"}
              dur="0.6s"
              begin={`${0.2 + i * 0.13}s`}
              fill="freeze"
            />
          </circle>
          {i === 8 && (
            <circle
              cx={x}
              cy={y}
              r="20"
              fill="none"
              stroke="color-mix(in oklab, var(--primary) 55%, transparent)"
              strokeWidth="0.8"
            />
          )}
        </g>
      ))}
    </svg>
  );
}

/** Horizontal hairline that ties one section into the next. */
export function Seam({ label }: { label?: string }) {
  return (
    <div aria-hidden className="relative mx-auto max-w-7xl px-6">
      <div
        className="h-px w-full"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,.13) 20%, rgba(255,255,255,.13) 80%, transparent)",
        }}
      />
      {label && (
        <div
          className="absolute left-6 -top-2 bg-[#000] pr-3 text-[9.5px] uppercase tracking-[0.28em] text-white/25"
          style={monoFont}
        >
          {label}
        </div>
      )}
    </div>
  );
}
