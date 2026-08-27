/**
 * ClickBox background art system.
 *
 * Railway-style atmospheric technical drawing: schematic grids, correlation
 * graphs, and signal pathways that sit *behind* the product and dissolve into
 * the black. Monochrome with a single restrained blue accent.
 */

/** Blueprint plate: fine grid + coarse grid + corner ticks, masked to fade. */
export function Schematic({
  className = "",
  opacity = 0.5,
}: {
  className?: string;
  opacity?: number;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{ opacity }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.18) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 45%, black, transparent 72%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 45%, black, transparent 72%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.4) 1px, transparent 1px)",
          backgroundSize: "132px 132px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 45%, black, transparent 76%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 45%, black, transparent 76%)",
        }}
      />
    </div>
  );
}

/** Slow drifting security graph — nodes with faint correlation edges. */
export function GraphField({
  className = "",
  opacity = 0.42,
}: {
  className?: string;
  opacity?: number;
}) {
  const nodes = [
    [90, 120],
    [260, 60],
    [410, 170],
    [560, 90],
    [700, 210],
    [140, 300],
    [330, 340],
    [500, 300],
    [660, 380],
    [820, 130],
    [230, 460],
    [430, 480],
    [610, 470],
    [790, 300],
    [60, 380],
  ] as const;
  const edges: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [0, 5],
    [5, 6],
    [6, 2],
    [6, 7],
    [7, 4],
    [4, 8],
    [3, 9],
    [9, 13],
    [8, 13],
    [5, 14],
    [10, 6],
    [10, 11],
    [11, 7],
    [11, 12],
    [12, 8],
    [14, 10],
  ];
  return (
    <svg
      aria-hidden
      viewBox="0 0 900 540"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      preserveAspectRatio="xMidYMid slice"
      style={{
        opacity,
        maskImage: "radial-gradient(ellipse 68% 70% at 50% 50%, black, transparent 78%)",
        WebkitMaskImage: "radial-gradient(ellipse 68% 70% at 50% 50%, black, transparent 78%)",
      }}
    >
      <g stroke="rgba(255,255,255,.22)" strokeWidth="0.7" fill="none">
        {edges.map(([a, b], i) => (
          <line
            key={i}
            x1={nodes[a][0]}
            y1={nodes[a][1]}
            x2={nodes[b][0]}
            y2={nodes[b][1]}
            strokeDasharray={i % 3 === 0 ? "2 7" : undefined}
          >
            {i % 3 === 0 && (
              <animate
                attributeName="stroke-dashoffset"
                values="0;-45"
                dur={`${7 + (i % 6)}s`}
                repeatCount="indefinite"
              />
            )}
          </line>
        ))}
      </g>
      {nodes.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={i % 7 === 0 ? 3.4 : 2} fill="rgba(255,255,255,.55)" />
          {i % 7 === 0 && (
            <circle
              cx={x}
              cy={y}
              r="13"
              fill="none"
              stroke="color-mix(in oklab, var(--primary) 55%, transparent)"
              strokeWidth="0.8"
            >
              <animate
                attributeName="r"
                values="9;22;9"
                dur={`${5 + i}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.7;0;0.7"
                dur={`${5 + i}s`}
                repeatCount="indefinite"
              />
            </circle>
          )}
        </g>
      ))}
    </svg>
  );
}

/** Long horizontal signal pathways — data in flight across a section. */
export function Pathways({
  className = "",
  opacity = 0.5,
}: {
  className?: string;
  opacity?: number;
}) {
  const rows = Array.from({ length: 9 }, (_, i) => i);
  return (
    <svg
      aria-hidden
      viewBox="0 0 1440 500"
      preserveAspectRatio="none"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      style={{ opacity }}
    >
      <defs>
        <linearGradient id="cb-path" x1="0" x2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0)" />
          <stop offset="45%" stopColor="rgba(255,255,255,.32)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      {rows.map((i) => {
        const y = 40 + i * 52;
        return (
          <g key={i}>
            <path
              d={`M -40 ${y} C 380 ${y}, 520 ${y + (i % 2 ? 70 : -70)}, 1480 ${y + (i % 2 ? 40 : -40)}`}
              fill="none"
              stroke="url(#cb-path)"
              strokeWidth={i % 3 === 0 ? 1 : 0.6}
            />
            <circle r="1.8" fill="color-mix(in oklab, var(--primary) 90%, white)">
              <animateMotion
                dur={`${9 + i * 1.6}s`}
                repeatCount="indefinite"
                path={`M -40 ${y} C 380 ${y}, 520 ${y + (i % 2 ? 70 : -70)}, 1480 ${y + (i % 2 ? 40 : -40)}`}
              />
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                dur={`${9 + i * 1.6}s`}
                repeatCount="indefinite"
              />
            </circle>
          </g>
        );
      })}
    </svg>
  );
}

/** Deep blue atmospheric wash, used sparingly as the accent glow. */
export function Glow({
  className = "",
  intensity = 0.16,
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
        )}%, transparent), transparent 70%)`,
        filter: "blur(60px)",
      }}
    />
  );
}
