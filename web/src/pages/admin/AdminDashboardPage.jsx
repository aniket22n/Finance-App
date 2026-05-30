import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoPeople, IoPerson, IoCalendar, IoChevronDown, IoCheckmark, IoArrowForward, IoClose } from 'react-icons/io5';
import { getAdminDashboard, getGroups, getAdminPaymentStats, errMsg } from '../../services/api';
import { useToast } from '../../components/Toast';
import Spinner from '../../components/Spinner';
import NotificationsBell from '../../components/NotificationsBell';

const fmt = (v = 0) => (v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : v >= 1000 ? `₹${(v / 1000).toFixed(1)}K` : `₹${v}`);

function greetingText() {
  const h = new Date().getHours();
  return h >= 5 && h < 12 ? 'Good morning' : h >= 12 && h < 17 ? 'Good afternoon' : 'Good evening';
}

// Donut chart (mirrors mobile DonutChart): verified/pending/failed arcs.
function Donut({ verifiedPct, pendingPct }) {
  const SIZE = 120, c = 60, R = 44, CIRC = 2 * Math.PI * R, SW = 14;
  const failedPct = Math.max(0, 100 - verifiedPct - pendingPct);
  const segs = [
    { pct: verifiedPct, color: '#10B981' },
    { pct: pendingPct, color: '#F59E0B' },
    { pct: failedPct, color: '#EF4444' },
  ];
  let cum = 0;
  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ flexShrink: 0 }}>
      <circle cx={c} cy={c} r={R} fill="none" stroke="var(--background-tertiary)" strokeWidth={SW} />
      {segs.map((s, i) => {
        if (s.pct <= 0) return null;
        const dash = (s.pct / 100) * CIRC;
        const offset = -(cum / 100) * CIRC;
        cum += s.pct;
        return (
          <circle key={i} cx={c} cy={c} r={R} fill="none" stroke={s.color} strokeWidth={SW}
            strokeDasharray={`${dash} ${CIRC}`} strokeDashoffset={offset} transform={`rotate(-90 ${c} ${c})`} />
        );
      })}
      <text x={c} y={c + 6} textAnchor="middle" fontSize="15" fontWeight="bold" fill="var(--text)">{verifiedPct}%</text>
    </svg>
  );
}

function FilterPill({ Icon, label, filtered, onClick }) {
  return (
    <button className="filter-pill" data-on={filtered ? 'true' : 'false'} onClick={onClick}>
      <Icon size={14} />
      <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <IoChevronDown size={12} />
    </button>
  );
}

function Sheet({ title, Icon, onClose, options, value, onSelect }) {
  return (
    <div className="sheet-backdrop" onMouseDown={onClose}>
      <div className="sheet" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <span className="center" style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--primary-light)' }}><Icon size={16} color="var(--primary)" /></span>
          <span style={{ fontWeight: 600 }}>{title}</span>
        </div>
        <div className="col gap-6" style={{ padding: '8px 12px', maxHeight: '50vh', overflowY: 'auto' }}>
          {options.map((o) => {
            const active = o.value === value;
            return (
              <button key={o.value} className={`sheet-opt ${active ? 'active' : ''}`} onClick={() => { onSelect(o.value); onClose(); }}>
                <span style={{ flex: 1, textAlign: 'left' }}>{o.label}</span>
                {active && <span className="checkbox" data-on="true"><IoCheckmark size={11} color="#fff" /></span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [groups, setGroups] = useState([]);
  const [filteredStats, setFilteredStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [openSheet, setOpenSheet] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [dash, g] = await Promise.all([getAdminDashboard(), getGroups()]);
        setStats(dash.data.stats || dash.data || {});
        setGroups(g.data.groups || g.data || []);
      } catch (err) {
        toast.error(errMsg(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const loadStats = useCallback(async (groupId, month) => {
    setStatsLoading(true);
    try {
      const res = await getAdminPaymentStats(groupId !== 'all' ? groupId : null, month !== 'all' ? month : null);
      setFilteredStats(res.data.data || res.data);
    } catch {
      setFilteredStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { loadStats(selectedGroup, selectedMonth); }, [selectedGroup, selectedMonth, loadStats]);

  if (loading) return <Spinner full />;

  const groupOptions = [{ value: 'all', label: 'All Groups' }, ...groups.map((g) => ({ value: g._id, label: g.name }))];
  const activeGroup = groups.find((g) => g._id === selectedGroup);
  const maxMonth = activeGroup ? (activeGroup.totalMonths || 24) : groups.length ? Math.max(...groups.map((g) => g.totalMonths || 0)) : 24;
  const monthOptions = [{ value: 'all', label: 'All Months' }, ...Array.from({ length: maxMonth }, (_, i) => ({ value: i + 1, label: `Month ${i + 1}` }))];

  const totalPayments = (filteredStats?.verifiedCount || 0) + (filteredStats?.pendingCount || 0);
  const verifiedPct = totalPayments > 0 ? Math.round((filteredStats.verifiedCount / totalPayments) * 100) : 0;
  const pendingPct = totalPayments > 0 ? Math.round((filteredStats.pendingCount / totalPayments) * 100) : 0;

  const statSections = filteredStats ? [
    { label: 'Collected', filter: 'verified', amount: filteredStats.verifiedAmount, count: filteredStats.verifiedCount, color: 'var(--success)', bg: 'var(--success-light)' },
    { label: 'Pending', filter: 'pending', amount: filteredStats.pendingAmount, count: filteredStats.pendingCount, color: 'var(--warning)', bg: 'var(--warning-light)' },
    { label: 'Total EMI', filter: 'all', amount: (filteredStats.verifiedAmount || 0) + (filteredStats.pendingAmount || 0), count: totalPayments, color: 'var(--primary)', bg: 'var(--primary-light)' },
  ] : [];

  return (
    <div>
      <header className="app-header">
        <div>
          <div className="greeting">{greetingText()}, Admin</div>
          <h1>Dashboard</h1>
        </div>
        <NotificationsBell />
      </header>

      <div className="screen" style={{ paddingTop: 6 }}>
        {/* Summary cards */}
        <div className="row gap-10">
          <div className="dash-sum" style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))' }}>
            <div className="row between" style={{ marginBottom: 6 }}>
              <span className="dash-sum-lbl">GROUPS</span>
              <IoPeople size={24} color="rgba(255,255,255,0.18)" />
            </div>
            <div className="dash-sum-val">{stats.totalGroups ?? 0}</div>
            <div className="row gap-6" style={{ marginTop: 2 }}>
              <span style={{ width: 6, height: 6, borderRadius: 3, background: '#4ade80' }} />
              <span className="dash-sum-sub">{stats.activeGroups ?? 0} active</span>
            </div>
          </div>
          <div className="dash-sum" style={{ background: 'linear-gradient(135deg, #1e293b, #334155)' }}>
            <div className="row between" style={{ marginBottom: 6 }}>
              <span className="dash-sum-lbl">MEMBERS</span>
              <IoPerson size={24} color="rgba(255,255,255,0.18)" />
            </div>
            <div className="dash-sum-val">{stats.totalUsers ?? 0}</div>
            <div className="row gap-6" style={{ marginTop: 2 }}>
              <span style={{ width: 6, height: 6, borderRadius: 3, background: '#60a5fa' }} />
              <span className="dash-sum-sub">registered</span>
            </div>
          </div>
        </div>

        {/* Payment overview */}
        <div className="section-title" style={{ marginTop: 20, marginBottom: 10 }}>PAYMENT OVERVIEW</div>
        <div className="row gap-8">
          <FilterPill Icon={IoPeople} label={selectedGroup === 'all' ? 'Group' : activeGroup?.name || 'Group'} filtered={selectedGroup !== 'all'} onClick={() => setOpenSheet('group')} />
          <FilterPill Icon={IoCalendar} label={selectedMonth === 'all' ? 'Month' : `Month ${selectedMonth}`} filtered={selectedMonth !== 'all'} onClick={() => setOpenSheet('month')} />
        </div>

        {statsLoading ? (
          <div className="center" style={{ padding: 24 }}><span className="spinner" /></div>
        ) : filteredStats ? (
          <>
            {/* 3-section stat card */}
            <div className="dash-stat-card mt-12">
              {statSections.map((s, i) => (
                <button key={s.label} className="dash-stat-sec" onClick={() => navigate('/admin/payments', { state: { filter: s.filter } })}>
                  <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: s.color }} />
                  <span className="dash-stat-badge" style={{ background: s.bg, color: s.color }}>{s.count}</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: s.color, marginBottom: 4 }}>{fmt(s.amount)}</span>
                  <span className="muted" style={{ fontSize: 11, fontWeight: 500 }}>{s.label}</span>
                  <IoArrowForward size={11} color={s.color} style={{ marginTop: 4, opacity: 0.7 }} />
                  {i > 0 && <span className="dash-stat-divider" />}
                </button>
              ))}
            </div>

            {/* Donut */}
            {totalPayments > 0 && (
              <>
                <div className="section-title" style={{ marginTop: 20, marginBottom: 10 }}>PAYMENT STATUS</div>
                <div className="card row" style={{ alignItems: 'center', gap: 0 }}>
                  <Donut verifiedPct={verifiedPct} pendingPct={pendingPct} />
                  <div className="col" style={{ flex: 1, paddingLeft: 16, gap: 14 }}>
                    {[
                      { label: 'Verified', pct: verifiedPct, color: '#10B981' },
                      { label: 'Pending', pct: pendingPct, color: '#F59E0B' },
                      { label: 'Other', pct: Math.max(0, 100 - verifiedPct - pendingPct), color: '#EF4444' },
                    ].map((it) => (
                      <div key={it.label} className="row gap-8">
                        <span style={{ width: 8, height: 8, borderRadius: 4, background: it.color }} />
                        <span className="muted" style={{ flex: 1, fontSize: 13 }}>{it.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{it.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        ) : null}
      </div>

      {openSheet === 'group' && (
        <Sheet title="Select Group" Icon={IoPeople} onClose={() => setOpenSheet(null)} options={groupOptions} value={selectedGroup}
          onSelect={(v) => { setSelectedGroup(v); setSelectedMonth('all'); }} />
      )}
      {openSheet === 'month' && (
        <Sheet title="Select Month" Icon={IoCalendar} onClose={() => setOpenSheet(null)} options={monthOptions} value={selectedMonth} onSelect={setSelectedMonth} />
      )}
    </div>
  );
}
