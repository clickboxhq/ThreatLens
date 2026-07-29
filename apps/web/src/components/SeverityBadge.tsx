const SEVERITY_COLOR: Record<string, string> = {
  informational: '#64748b',
  low: '#3b82f6',
  medium: '#eab308',
  high: '#f97316',
  critical: '#dc2626',
};

// §17.8: severity is always paired with a text label, never color alone.
export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 600,
        color: 'white',
        background: SEVERITY_COLOR[severity] ?? '#64748b',
        textTransform: 'uppercase',
      }}
    >
      {severity}
    </span>
  );
}
