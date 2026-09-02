import { Laptop, Monitor, Server, ShieldCheck, Smartphone, Terminal } from "lucide-react";

/**
 * A quiet, non-interactive field of endpoint/device glyphs behind the Endpoint Center's
 * workspace area — ambient background texture, not content. Every icon is `aria-hidden` and
 * the whole layer is `pointer-events-none`: nothing in here is ever clickable, hoverable, or
 * announced to assistive tech. The only real interaction on this page is the host list itself.
 *
 * Built from ThreatLens's own icon set (lucide, already used everywhere else in the app) at
 * very low opacity, arranged with a light hand-tuned scatter rather than a perfectly regular
 * grid so it reads as texture rather than a literal repeating tile.
 */
const GLYPHS = [Monitor, Laptop, Server, Terminal, ShieldCheck, Smartphone];

// Hand-placed rows: [glyph index, left offset within the row, size, rotation]. Deliberately
// irregular — a true grid of identical icons reads as a raster texture, this reads as a loose
// field of devices.
const ROWS: Array<Array<[number, number, number, number]>> = [
  [
    [0, 4, 34, -6],
    [2, 22, 26, 9],
    [4, 40, 30, -3],
    [1, 58, 24, 12],
    [3, 76, 32, -8],
    [5, 92, 22, 5],
  ],
  [
    [3, -2, 24, 8],
    [1, 15, 32, -10],
    [5, 33, 28, 4],
    [0, 52, 22, -5],
    [2, 70, 34, 7],
    [4, 88, 26, -9],
  ],
  [
    [5, 6, 28, -4],
    [4, 24, 22, 11],
    [0, 43, 34, -7],
    [3, 61, 26, 3],
    [1, 79, 30, -11],
    [2, 96, 24, 6],
  ],
  [
    [2, 0, 26, 10],
    [0, 19, 30, -6],
    [4, 37, 24, 8],
    [5, 56, 32, -3],
    [3, 74, 22, 12],
    [1, 91, 28, -8],
  ],
];

export function EndpointIconField() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
    >
      {ROWS.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className="absolute left-0 right-0"
          style={{ top: `${8 + rowIndex * 24}%` }}
        >
          {row.map(([glyphIndex, left, size, rotate], i) => {
            const Icon = GLYPHS[glyphIndex];
            return (
              <Icon
                key={i}
                className="absolute text-muted-foreground/[0.06]"
                style={{
                  left: `${left}%`,
                  width: size,
                  height: size,
                  transform: `rotate(${rotate}deg)`,
                }}
                strokeWidth={1.25}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
