import type { SkillRadarEntry } from '../api/types';

const SIZE = 340;
const CENTER = SIZE / 2;
const MAX_RADIUS = SIZE / 2 - 70;
const GRID_LEVELS = [0.25, 0.5, 0.75, 1];

function pointFor(index: number, count: number, radiusFraction: number) {
  const angle = -Math.PI / 2 + index * ((2 * Math.PI) / count);
  return {
    x: CENTER + Math.cos(angle) * MAX_RADIUS * radiusFraction,
    y: CENTER + Math.sin(angle) * MAX_RADIUS * radiusFraction,
  };
}

function colorFor(percent: number): string {
  if (percent >= 70) return '#16a34a';
  if (percent >= 40) return '#d97706';
  return '#dc2626';
}

// Hand-rolled inline SVG — this app deliberately uses no charting library anywhere (see
// GlobalTimeline), so the radar shape is plotted directly from polar coordinates rather than
// pulling in a dependency for one chart.
export function SkillRadarChart({ entries }: { entries: SkillRadarEntry[] }) {
  if (entries.length < 3) {
    return (
      <p style={{ color: '#64748b', fontSize: 14 }}>
        Complete a few more scored scenarios across different tactics to unlock your skill radar.
      </p>
    );
  }

  const count = entries.length;
  const dataPoints = entries.map((e, i) => pointFor(i, count, Math.max(e.percent, 0) / 100));
  const dataPath = dataPoints.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Skill proficiency by MITRE ATT&CK tactic">
      {GRID_LEVELS.map((level) => (
        <polygon
          key={level}
          points={entries.map((_, i) => { const p = pointFor(i, count, level); return `${p.x},${p.y}`; }).join(' ')}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={1}
        />
      ))}
      {entries.map((_, i) => {
        const p = pointFor(i, count, 1);
        return <line key={i} x1={CENTER} y1={CENTER} x2={p.x} y2={p.y} stroke="#e2e8f0" strokeWidth={1} />;
      })}
      <polygon points={dataPath} fill="rgba(37, 99, 235, 0.2)" stroke="#2563eb" strokeWidth={2} />
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={colorFor(entries[i].percent)} />
      ))}
      {entries.map((e, i) => {
        const label = pointFor(i, count, 1.22);
        return (
          <text key={i} x={label.x} y={label.y} fontSize={11} textAnchor="middle" dominantBaseline="middle" fill="#334155">
            {e.tacticName}
          </text>
        );
      })}
    </svg>
  );
}
