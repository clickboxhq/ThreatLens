import { useId } from "react";

/**
 * A quiet, non-interactive field of endpoint/device glyphs tiled across the Endpoint Center's
 * entire workspace — ambient background texture, not content. `aria-hidden` and
 * `pointer-events-none`: nothing here is ever clickable, hoverable, or announced to assistive
 * tech. The only real interaction on this page is the host list itself.
 *
 * Built as a genuine repeating SVG pattern rather than a hand-placed scatter — a fixed set of
 * rows landed wrong the moment table height varied (more/fewer devices) and couldn't cover a
 * page taller than the row count without either guessing or a giant array. A tiled pattern
 * fills whatever height the caller's container ends up being, automatically.
 *
 * Each tile carries three glyphs (monitor, laptop, shield) at a generous size and an even
 * three-way rotation so it reads as a considered emblem set, not a single icon copy-pasted.
 */
export function EndpointIconField() {
  const id = useId();

  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full select-none">
      <defs>
        <pattern
          id={id}
          width={220}
          height={220}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-8)"
        >
          {/* Monitor */}
          <g
            transform="translate(18 22)"
            stroke="var(--info)"
            strokeWidth={1.4}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x={0} y={0} width={62} height={42} rx={5} />
            <path d="M22 42v10M42 42v10M16 52h32" />
          </g>
          {/* Laptop */}
          <g
            transform="translate(120 24) rotate(10)"
            stroke="var(--info)"
            strokeWidth={1.4}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x={0} y={0} width={58} height={38} rx={4} />
            <path d="M-6 44h70l-6 10H0z" />
          </g>
          {/* Shield-check */}
          <g
            transform="translate(60 128) rotate(-6)"
            stroke="var(--info)"
            strokeWidth={1.4}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M26 0 50 9v20c0 17-10 28-24 33C12 57 2 46 2 29V9Z" />
            <path d="M14 27l8 8 16-17" />
          </g>
          {/* Terminal */}
          <g
            transform="translate(150 140)"
            stroke="var(--info)"
            strokeWidth={1.4}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x={0} y={0} width={54} height={40} rx={5} />
            <path d="M10 14l10 8-10 8M28 30h16" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} opacity={0.1} />
    </svg>
  );
}
