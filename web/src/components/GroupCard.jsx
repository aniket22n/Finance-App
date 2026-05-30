import { useNavigate } from 'react-router-dom';
import { IoPeople, IoChevronForward } from 'react-icons/io5';
import { inr } from '../utils/format';

// Mirrors mobile GroupCard: left accent bar, icon + name + EMI/mo + chevron,
// then a thin progress bar with "Month x/y · pct% · ₹pot pot" meta.
export default function GroupCard({ group, to, onClick }) {
  const navigate = useNavigate();
  const progress = group.totalMonths > 0
    ? Math.round((group.currentMonth / group.totalMonths) * 100)
    : 0;
  const isActive = group.status === 'active';
  const accent = isActive ? 'var(--primary)' : 'var(--text-tertiary)';

  const handle = onClick || (() => to && navigate(to));

  return (
    <div className="gcard" onClick={handle}>
      <span className="gcard-accent" style={{ background: accent }} />
      <div className="gcard-inner">
        <div className="gcard-top">
          <span className="gcard-icon">
            <IoPeople size={16} color="var(--primary)" />
          </span>
          <span className="gcard-name">{group.name}</span>
          <span className="gcard-emi">
            <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{inr(group.emiAmount)}</span>
            <span className="gcard-emi-lbl">/mo</span>
          </span>
          <IoChevronForward size={16} color="var(--text-tertiary)" style={{ marginLeft: 4 }} />
        </div>

        <div className="gcard-bar">
          <span className="gcard-bar-fill" style={{ width: `${progress}%`, background: accent }} />
        </div>
        <div className="gcard-meta">
          Month {group.currentMonth}/{group.totalMonths}
          {'  ·  '}
          <span style={{ color: accent }}>{progress}%</span>
          {'  ·  '}
          {inr(group.potAmount)} pot
        </div>
      </div>
    </div>
  );
}
