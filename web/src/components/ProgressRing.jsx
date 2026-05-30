// SVG progress ring matching mobile: track + primary arc, centered percentage
// with an optional caption below. Accepts either value/max or a 0-100 progress.
export default function ProgressRing({
  value, max = 1, progress, size = 100, stroke = 8, color = 'var(--primary)', label, centerText,
}) {
  const pct = progress != null
    ? Math.max(0, Math.min(100, progress))
    : (max > 0 ? Math.min(100, (value / max) * 100) : 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="var(--background-tertiary)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset .4s' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: size > 80 ? 18 : 14, fontWeight: 700, color: 'var(--text)' }}>
          {centerText != null ? centerText : `${Math.round(pct)}%`}
        </span>
        {label && <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{label}</span>}
      </div>
    </div>
  );
}
