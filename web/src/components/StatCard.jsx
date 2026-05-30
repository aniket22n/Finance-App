export default function StatCard({ label, value, sub, color = 'var(--primary)', icon }) {
  return (
    <div className="card">
      <div className="row between">
        <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
        {icon && <span style={{ fontSize: 18, color, display: 'flex' }}>{icon}</span>}
      </div>
      <div className="amount" style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color }}>{value}</div>
      {sub && <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
