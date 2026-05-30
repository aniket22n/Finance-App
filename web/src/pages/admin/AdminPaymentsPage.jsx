import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  IoInformationCircleOutline, IoFunnel, IoPeople, IoCalendar, IoChevronDown,
  IoCheckmark, IoListOutline, IoReorderFourOutline, IoPersonOutline, IoReceiptOutline, IoClose,
} from 'react-icons/io5';
import { getAdminPaymentsList, getGroups, errMsg } from '../../services/api';
import { useToast } from '../../components/Toast';
import Spinner from '../../components/Spinner';

const STATUS_OPTIONS = [
  { id: 'all', label: 'All Statuses', dot: null },
  { id: 'awaiting', label: 'Awaiting', dot: '#F59E0B' },
  { id: 'pending', label: 'Pending', dot: '#6B7280' },
  { id: 'verified', label: 'Verified', dot: '#10B981' },
  { id: 'rejected', label: 'Rejected', dot: '#EF4444' },
];

const STATUS_INFO = [
  { dot: '#F59E0B', label: 'Awaiting', desc: 'Member has paid. You need to verify it.' },
  { dot: '#6B7280', label: 'Pending', desc: 'Member has not paid yet.', hint: 'You can send a reminder. Once they pay, it becomes Awaiting.' },
  { dot: '#10B981', label: 'Verified', desc: 'Payment is confirmed.', hint: 'You can change it to Rejected if something is wrong.' },
  { dot: '#EF4444', label: 'Rejected', desc: 'Payment was not accepted.', hint: 'Change to Verified if it was a mistake. Once member pays again, it becomes Awaiting.' },
];

const BADGE = {
  paid: { bg: '#F59E0B', label: 'Awaiting' },
  pending: { bg: '#9CA3AF', label: 'Pending' },
  verified: { bg: '#10B981', label: 'Verified' },
  failed: { bg: '#EF4444', label: 'Rejected' },
  rejected: { bg: '#EF4444', label: 'Rejected' },
};

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function groupLabel(group) {
  if (!group?.name) return null;
  if (group.potAmount) {
    const k = group.potAmount >= 1000 ? `₹${group.potAmount / 1000}K` : `₹${group.potAmount}`;
    return `${group.name} — ${k}`;
  }
  return group.name;
}

// A filter pill that opens a dropdown sheet. `filtered` highlights it in primary.
function FilterPill({ Icon, label, filtered, onClick }) {
  return (
    <button className="filter-pill" data-on={filtered ? 'true' : 'false'} onClick={onClick}>
      <Icon size={13} />
      <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <IoChevronDown size={11} />
    </button>
  );
}

// Bottom-sheet style dropdown rendered inside the phone frame.
function Sheet({ title, Icon, onClose, children }) {
  return (
    <div className="sheet-backdrop" onMouseDown={onClose}>
      <div className="sheet" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <span className="center" style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--primary-light)' }}><Icon size={16} color="var(--primary)" /></span>
          <span style={{ fontWeight: 600 }}>{title}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function AdminPaymentsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  // Map an inbound filter (from OTP confirm) onto the status multi-select.
  const initialStatuses = useMemo(() => {
    const f = location.state?.filter;
    if (!f || f === 'all') return ['all'];
    if (f === 'pending') return ['awaiting', 'pending', 'rejected'];
    return STATUS_OPTIONS.some((o) => o.id === f) ? [f] : ['all'];
  }, [location.state]);

  const [statuses, setStatuses] = useState(initialStatuses);
  const [groupId, setGroupId] = useState('all');
  const [month, setMonth] = useState('all');
  const [groups, setGroups] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [compact, setCompact] = useState(false);

  const [openSheet, setOpenSheet] = useState(null); // 'status' | 'group' | 'month'
  const [infoOpen, setInfoOpen] = useState(false);

  const loadedGroups = useRef(false);
  useEffect(() => {
    if (loadedGroups.current) return;
    loadedGroups.current = true;
    getGroups().then((r) => setGroups(r.data.groups || r.data || [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAdminPaymentsList({ statuses, group: groupId, month });
      setPayments(res.data.payments || res.data || []);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setLoading(false);
    }
  }, [statuses, groupId, month, toast]);

  useEffect(() => { load(); }, [load]);

  const toggleStatus = (id) => {
    setStatuses((prev) => {
      if (id === 'all') return ['all'];
      const without = prev.filter((s) => s !== 'all' && s !== id);
      const next = prev.includes(id) ? without : [...without, id];
      return next.length === 0 ? ['all'] : next;
    });
  };

  const isAllStatus = statuses.includes('all');
  const statusLabel = isAllStatus ? 'Status'
    : statuses.length === 1 ? STATUS_OPTIONS.find((o) => o.id === statuses[0])?.label || 'Status'
    : `${statuses.length} selected`;

  const activeGroup = groups.find((g) => g._id === groupId);
  const maxMonth = activeGroup ? (activeGroup.totalMonths || 24) : groups.length ? Math.max(...groups.map((g) => g.totalMonths || 0)) : 24;
  const groupName = groupId === 'all' ? 'All Groups' : activeGroup?.name || 'Group';
  const monthName = month === 'all' ? 'All Months' : `Month ${month}`;

  return (
    <div>
      <header className="app-header">
        <h1>Payments</h1>
        <button className="iconbtn" onClick={() => setInfoOpen(true)} aria-label="Status info">
          <IoInformationCircleOutline size={24} color="var(--text-secondary)" />
        </button>
      </header>

      {/* Filter pills */}
      <div className="row gap-8" style={{ padding: '8px 14px' }}>
        <FilterPill Icon={IoFunnel} label={statusLabel} filtered={!isAllStatus} onClick={() => setOpenSheet('status')} />
        <FilterPill Icon={IoPeople} label={groupName} filtered={groupId !== 'all'} onClick={() => setOpenSheet('group')} />
        <FilterPill Icon={IoCalendar} label={monthName} filtered={month !== 'all'} onClick={() => setOpenSheet('month')} />
      </div>

      {/* Count + compact toggle */}
      <div className="row between" style={{ padding: '0 16px 6px' }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.6, color: 'var(--text-tertiary)' }}>
          {payments.length} PAYMENT{payments.length !== 1 ? 'S' : ''}
        </span>
        <button className="iconbtn-sm" data-on={compact ? 'true' : 'false'} onClick={() => setCompact((v) => !v)} aria-label="Toggle compact">
          {compact ? <IoListOutline size={16} /> : <IoReorderFourOutline size={16} />}
        </button>
      </div>

      <div className="screen" style={{ paddingBottom: 16 }}>
        {loading ? (
          <Spinner full />
        ) : payments.length === 0 ? (
          <div className="empty"><IoReceiptOutline size={40} /><div>No payments match filters</div></div>
        ) : (
          <div className="col gap-8">
            {payments.map((p) => {
              const badge = BADGE[p.status] || { bg: 'var(--border)', label: p.status };
              const isRejected = p.status === 'failed' || p.status === 'rejected';
              const gl = groupLabel(p.group);
              return (
                <button
                  key={p._id}
                  className="pay-card"
                  style={isRejected ? { borderLeft: '3px solid #EF4444' } : undefined}
                  onClick={() => navigate(`/admin/payments/${p._id}`, { state: { payment: p } })}
                >
                  {!compact && (
                    <span className="center pay-avatar"><IoPersonOutline size={20} color="var(--text-secondary)" /></span>
                  )}
                  <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <span className="row between gap-8" style={{ marginBottom: 4 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.user?.name || p.user?.phone || 'Member'}
                      </span>
                      <span style={{ background: badge.bg, color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 100, flexShrink: 0 }}>{badge.label}</span>
                    </span>
                    <span style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 3 }}>
                      ₹{p.amount?.toLocaleString('en-IN')} · {(p.paymentMethod || 'UPI').toUpperCase()} · {timeAgo(p.paidAt || p.createdAt)}
                    </span>
                    {!compact && (
                      <span className="faint" style={{ display: 'block', fontSize: 12 }}>
                        Month {p.month}{gl ? ` · ${gl}` : ''}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Status multi-select sheet */}
      {openSheet === 'status' && (
        <Sheet title="Filter by Status" Icon={IoFunnel} onClose={() => setOpenSheet(null)}>
          <div className="col gap-6" style={{ padding: '8px 12px' }}>
            {STATUS_OPTIONS.map((opt) => {
              const active = opt.id === 'all' ? isAllStatus : statuses.includes(opt.id);
              return (
                <button key={opt.id} className={`sheet-opt ${active ? 'active' : ''}`} onClick={() => toggleStatus(opt.id)}>
                  <span className="row gap-10" style={{ flex: 1 }}>
                    {opt.dot ? <span style={{ width: 9, height: 9, borderRadius: 5, background: opt.dot }} /> : <span style={{ width: 9 }} />}
                    <span>{opt.label}</span>
                  </span>
                  <span className="checkbox" data-on={active ? 'true' : 'false'}>{active && <IoCheckmark size={11} color="#fff" />}</span>
                </button>
              );
            })}
          </div>
          <button className="btn btn-block" style={{ margin: '8px 16px 0', width: 'calc(100% - 32px)' }} onClick={() => setOpenSheet(null)}>Done</button>
        </Sheet>
      )}

      {/* Group single-select sheet */}
      {openSheet === 'group' && (
        <Sheet title="Select Group" Icon={IoPeople} onClose={() => setOpenSheet(null)}>
          <div className="col gap-6" style={{ padding: '8px 12px' }}>
            {[{ value: 'all', label: 'All Groups' }, ...groups.map((g) => ({ value: g._id, label: g.name }))].map((o) => {
              const active = o.value === groupId;
              return (
                <button key={o.value} className={`sheet-opt ${active ? 'active' : ''}`} onClick={() => { setGroupId(o.value); setMonth('all'); setOpenSheet(null); }}>
                  <span style={{ flex: 1, textAlign: 'left' }}>{o.label}</span>
                  {active && <span className="checkbox" data-on="true"><IoCheckmark size={11} color="#fff" /></span>}
                </button>
              );
            })}
          </div>
        </Sheet>
      )}

      {/* Month single-select sheet */}
      {openSheet === 'month' && (
        <Sheet title="Select Month" Icon={IoCalendar} onClose={() => setOpenSheet(null)}>
          <div className="col gap-6" style={{ padding: '8px 12px', maxHeight: '50vh', overflowY: 'auto' }}>
            {[{ value: 'all', label: 'All Months' }, ...Array.from({ length: maxMonth }, (_, i) => ({ value: i + 1, label: `Month ${i + 1}` }))].map((o) => {
              const active = o.value === month;
              return (
                <button key={o.value} className={`sheet-opt ${active ? 'active' : ''}`} onClick={() => { setMonth(o.value); setOpenSheet(null); }}>
                  <span style={{ flex: 1, textAlign: 'left' }}>{o.label}</span>
                  {active && <span className="checkbox" data-on="true"><IoCheckmark size={11} color="#fff" /></span>}
                </button>
              );
            })}
          </div>
        </Sheet>
      )}

      {/* Status legend modal */}
      {infoOpen && (
        <div className="modal-backdrop" onMouseDown={() => setInfoOpen(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="row between mb-16"><h3 style={{ fontSize: 15 }}>Payment Statuses</h3><button className="btn btn-ghost btn-sm" onClick={() => setInfoOpen(false)} style={{ border: 'none' }}><IoClose size={18} /></button></div>
            {STATUS_INFO.map((item, i) => (
              <div key={item.label} className="row gap-12" style={{ alignItems: 'flex-start', padding: '10px 0', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 5, background: item.dot, marginTop: 3, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{item.label}</div>
                  <div className="muted" style={{ fontSize: 12, lineHeight: 1.4 }}>{item.desc}</div>
                  {item.hint && <div className="faint" style={{ fontSize: 11, lineHeight: 1.4, marginTop: 3 }}>{item.hint}</div>}
                </div>
              </div>
            ))}
            <button className="btn btn-block mt-16" onClick={() => setInfoOpen(false)}>Got it</button>
          </div>
        </div>
      )}
    </div>
  );
}
