import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IoFunnel, IoPeople, IoCalendar, IoChevronDown, IoCheckmark, IoReceiptOutline,
  IoListOutline, IoReorderFourOutline, IoCard, IoRefresh, IoClose, IoChevronForward,
  IoQrCode, IoBusiness, IoCash, IoInformationCircle, IoAlertCircle,
} from 'react-icons/io5';
import { useAuth } from '../context/AuthContext';
import { getUserPayments, getGroups, initiatePayment, getPaymentConfig, errMsg } from '../services/api';
import { useToast } from '../components/Toast';
import Spinner from '../components/Spinner';

const STATUS_OPTIONS = [
  { id: 'all', label: 'All Statuses', dot: null },
  { id: 'awaiting', label: 'Awaiting', dot: '#F59E0B' },
  { id: 'pending', label: 'Pending', dot: '#6B7280' },
  { id: 'verified', label: 'Verified', dot: '#10B981' },
  { id: 'rejected', label: 'Rejected', dot: '#EF4444' },
];
const BADGE = {
  paid: { bg: '#F59E0B', label: 'Awaiting' }, pending: { bg: '#9CA3AF', label: 'Pending' },
  verified: { bg: '#10B981', label: 'Verified' }, failed: { bg: '#EF4444', label: 'Rejected' }, rejected: { bg: '#EF4444', label: 'Rejected' },
};
const FILTER_DB = { awaiting: ['paid'], pending: ['pending'], verified: ['verified'], rejected: ['failed', 'rejected'] };
const METHODS = [
  { id: 'upi', Icon: IoQrCode, color: 'var(--success)', label: 'UPI', sub: 'GPay, PhonePe, Paytm — 0% fee' },
  { id: 'bank', Icon: IoBusiness, color: 'var(--info)', label: 'Bank Transfer', sub: 'NEFT / IMPS / RTGS' },
  { id: 'cash', Icon: IoCash, color: 'var(--warning)', label: 'Cash', sub: 'Admin verifies in person' },
];

function timeAgo(d) {
  if (!d) return '—';
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function FilterPill({ Icon, label, filtered, onClick }) {
  return (
    <button className="filter-pill" data-on={filtered ? 'true' : 'false'} onClick={onClick}>
      <Icon size={13} />
      <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <IoChevronDown size={11} />
    </button>
  );
}
function Sheet({ title, Icon, onClose, children, footer }) {
  return (
    <div className="sheet-backdrop" onMouseDown={onClose}>
      <div className="sheet" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <span className="center" style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--primary-light)' }}><Icon size={16} color="var(--primary)" /></span>
          <span style={{ fontWeight: 600 }}>{title}</span>
        </div>
        {children}
        {footer}
      </div>
    </div>
  );
}

export default function PaymentsHistoryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [payments, setPayments] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [upiVpa, setUpiVpa] = useState('admin@upi');

  const [statuses, setStatuses] = useState(['all']);
  const [groupId, setGroupId] = useState('all');
  const [month, setMonth] = useState('all');
  const [compact, setCompact] = useState(false);
  const [openSheet, setOpenSheet] = useState(null);

  // quick-pay modal
  const [selectedPay, setSelectedPay] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [utr, setUtr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [pRes, gRes, cRes] = await Promise.all([
        getUserPayments(user._id), getGroups(), getPaymentConfig().catch(() => ({ data: {} })),
      ]);
      setPayments(pRes.data.payments || pRes.data || []);
      setGroups(gRes.data.groups || gRes.data || []);
      if (cRes.data?.upiVpa) setUpiVpa(cRes.data.upiVpa);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setLoading(false);
    }
  }, [user._id, toast]);
  useEffect(() => { loadData(); }, [loadData]);

  const toggleStatus = (id) => setStatuses((prev) => {
    if (id === 'all') return ['all'];
    const without = prev.filter((s) => s !== 'all' && s !== id);
    const next = prev.includes(id) ? without : [...without, id];
    return next.length === 0 ? ['all'] : next;
  });

  const submitPayment = async (method) => {
    if (!selectedPay || submitting) return;
    setSubmitting(true);
    try {
      await initiatePayment({
        groupId: selectedPay.group?._id || selectedPay.group, month: selectedPay.month,
        amount: selectedPay.amount, paymentMethod: method, upiTransactionId: utr,
      });
      setSelectedPay(null); setPaymentMethod(''); setUtr('');
      toast.success('Payment submitted — pending verification');
      setTimeout(loadData, 400);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUPIPay = () => {
    const g = selectedPay.group?.name || 'Group';
    const url = `upi://pay?pa=${upiVpa}&pn=EMI+Group&am=${selectedPay.amount}&tn=EMI+Month+${selectedPay.month}+${g}&cu=INR`;
    window.location.href = url;
    submitPayment('upi');
  };

  const visible = useMemo(() => {
    const isAll = statuses.includes('all');
    return payments.filter((p) => {
      if (!isAll) {
        const allowed = statuses.flatMap((s) => FILTER_DB[s] || [s]);
        if (!allowed.includes(p.status)) return false;
      }
      if (groupId !== 'all' && (p.group?._id || p.group) !== groupId) return false;
      if (month !== 'all' && p.month !== month) return false;
      return true;
    }).sort((a, b) => {
      const rank = { pending: 0, failed: 1, rejected: 1, paid: 2, verified: 3 };
      return (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || (b.month || 0) - (a.month || 0);
    });
  }, [payments, statuses, groupId, month]);

  if (loading) return <Spinner full />;

  const isAllStatus = statuses.includes('all');
  const statusLabel = isAllStatus ? 'Status' : statuses.length === 1 ? STATUS_OPTIONS.find((o) => o.id === statuses[0])?.label : `${statuses.length} selected`;
  const maxMonth = groups.length ? Math.max(...groups.map((g) => g.totalMonths || 0), 24) : 24;
  const groupName = groupId === 'all' ? 'All Groups' : groups.find((g) => g._id === groupId)?.name || 'Group';
  const isResubmit = selectedPay?.status === 'rejected' || selectedPay?.status === 'failed';

  return (
    <div>
      <header className="app-header"><h1>Payments</h1></header>

      <div className="row gap-8" style={{ padding: '8px 14px' }}>
        <FilterPill Icon={IoFunnel} label={statusLabel} filtered={!isAllStatus} onClick={() => setOpenSheet('status')} />
        <FilterPill Icon={IoPeople} label={groupName} filtered={groupId !== 'all'} onClick={() => setOpenSheet('group')} />
        <FilterPill Icon={IoCalendar} label={month === 'all' ? 'All Months' : `Month ${month}`} filtered={month !== 'all'} onClick={() => setOpenSheet('month')} />
      </div>

      <div className="row between" style={{ padding: '0 16px 6px' }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.6, color: 'var(--text-tertiary)' }}>{visible.length} PAYMENT{visible.length !== 1 ? 'S' : ''}</span>
        <button className="iconbtn-sm" data-on={compact ? 'true' : 'false'} onClick={() => setCompact((v) => !v)}>
          {compact ? <IoListOutline size={16} /> : <IoReorderFourOutline size={16} />}
        </button>
      </div>

      <div className="screen">
        {visible.length === 0 ? (
          <div className="empty"><IoReceiptOutline size={40} /><div>No payments match filters</div></div>
        ) : (
          <div className="col gap-10">
            {visible.map((p) => {
              const badge = BADGE[p.status] || { bg: 'var(--border)', label: p.status };
              const isRejected = p.status === 'failed' || p.status === 'rejected';
              const canPay = p.status === 'pending' || isRejected;
              const groupObj = typeof p.group === 'object' ? p.group : groups.find((g) => g._id === p.group);
              return (
                <div key={p._id} className="pay-card" style={{ alignItems: 'flex-start', display: 'flex', cursor: 'default', ...(isRejected ? { borderLeft: '3px solid #EF4444' } : {}) }}>
                  {!compact && <span className="center pay-avatar"><IoReceiptOutline size={20} color="var(--text-secondary)" /></span>}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <button onClick={() => navigate(`/payments/${p._id}`, { state: { payment: p } })} style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      <div className="row between gap-8" style={{ marginBottom: 4 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{groupObj?.name || `Month ${p.month}`}</span>
                        <span style={{ background: badge.bg, color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 100, flexShrink: 0 }}>{badge.label}</span>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>₹{p.amount?.toLocaleString('en-IN')} · {(p.paymentMethod || 'UPI').toUpperCase()} · {timeAgo(p.paidAt || p.createdAt)}</div>
                      {!compact && <div className="faint" style={{ fontSize: 12 }}>Month {p.month}</div>}
                    </button>
                    {canPay && (
                      <button className="btn btn-block btn-sm mt-8" style={isRejected ? { background: '#EF4444', border: 'none', color: '#fff' } : undefined}
                        onClick={() => { setSelectedPay(p); setPaymentMethod(''); setUtr(''); }}>
                        {isRejected ? <IoRefresh size={14} /> : <IoCard size={14} />} {isRejected ? 'Resubmit Payment' : 'Make Payment'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Status sheet (multi) */}
      {openSheet === 'status' && (
        <Sheet title="Filter by Status" Icon={IoFunnel} onClose={() => setOpenSheet(null)}
          footer={<button className="btn btn-block" style={{ margin: '8px 16px 0', width: 'calc(100% - 32px)' }} onClick={() => setOpenSheet(null)}>Done</button>}>
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
        </Sheet>
      )}
      {openSheet === 'group' && (
        <Sheet title="Select Group" Icon={IoPeople} onClose={() => setOpenSheet(null)}>
          <div className="col gap-6" style={{ padding: '8px 12px' }}>
            {[{ value: 'all', label: 'All Groups' }, ...groups.map((g) => ({ value: g._id, label: g.name }))].map((o) => {
              const active = o.value === groupId;
              return (
                <button key={o.value} className={`sheet-opt ${active ? 'active' : ''}`} onClick={() => { setGroupId(o.value); setOpenSheet(null); }}>
                  <span style={{ flex: 1, textAlign: 'left' }}>{o.label}</span>
                  {active && <span className="checkbox" data-on="true"><IoCheckmark size={11} color="#fff" /></span>}
                </button>
              );
            })}
          </div>
        </Sheet>
      )}
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

      {/* Quick-pay modal */}
      {selectedPay && (
        <div className="sheet-backdrop" onMouseDown={() => !submitting && setSelectedPay(null)}>
          <div className="sheet" onMouseDown={(e) => e.stopPropagation()} style={{ padding: '0 24px 36px' }}>
            <div className="sheet-handle" />
            <div className="row between" style={{ alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <h3 style={{ fontSize: 20 }}>{isResubmit ? 'Resubmit Payment' : 'Choose Payment Method'}</h3>
                <div className="muted" style={{ fontSize: 14, marginTop: 3 }}>₹{selectedPay.amount?.toLocaleString()} · {selectedPay.group?.name || `Month ${selectedPay.month}`}</div>
              </div>
              {!submitting && <button className="btn btn-ghost btn-sm" onClick={() => setSelectedPay(null)} style={{ border: 'none' }}><IoClose size={22} /></button>}
            </div>

            {isResubmit && selectedPay.notes && (
              <div className="row gap-8 mb-16" style={{ background: 'var(--st-rejected-bg)', border: '1px solid var(--st-rejected-bd)', borderRadius: 10, padding: 12, alignItems: 'flex-start' }}>
                <IoAlertCircle size={16} color="var(--st-rejected-fg)" style={{ marginTop: 1, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--st-rejected-fg)', marginBottom: 2 }}>Rejected by admin</div>
                  <div style={{ fontSize: 12, color: 'var(--st-rejected-fg)', lineHeight: 1.4 }}>{selectedPay.notes}</div>
                </div>
              </div>
            )}

            {!paymentMethod ? (
              <div className="col gap-10">
                {METHODS.map((m) => (
                  <button key={m.id} className="card row gap-12" style={{ alignItems: 'center', cursor: 'pointer', boxShadow: 'none' }}
                    onClick={() => (m.id === 'upi' ? handleUPIPay() : setPaymentMethod(m.id))}>
                    <span className="center" style={{ width: 44, height: 44, borderRadius: 12, background: `color-mix(in srgb, ${m.color} 15%, transparent)` }}><m.Icon size={24} color={m.color} /></span>
                    <span style={{ flex: 1, textAlign: 'left' }}>
                      <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{m.label}</span>
                      <span className="muted" style={{ display: 'block', fontSize: 11, marginTop: 1 }}>{m.sub}</span>
                    </span>
                    <IoChevronForward size={16} color="var(--text-secondary)" />
                  </button>
                ))}
              </div>
            ) : (
              <div>
                {paymentMethod === 'bank' && (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 500, margin: '4px 0 8px' }}>Bank Account Details</div>
                    <div className="card mb-16" style={{ background: 'var(--background-secondary)' }}>
                      {[['Account Name', 'EMI Group Admin'], ['Account No', '1234567890'], ['IFSC Code', 'HDFC0001234'], ['Bank', 'HDFC Bank']].map(([k, v]) => (
                        <div key={k} className="row between mb-8"><span className="muted" style={{ fontSize: 11 }}>{k}</span><span style={{ fontSize: 14, fontWeight: 600 }}>{v}</span></div>
                      ))}
                    </div>
                    <div className="field"><label>UTR / Reference Number</label>
                      <input className="input" value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="Enter transaction reference" /></div>
                  </>
                )}
                {paymentMethod === 'cash' && (
                  <div className="row gap-10 mb-8" style={{ background: 'var(--warning-light)', borderRadius: 10, padding: 14, alignItems: 'flex-start' }}>
                    <IoInformationCircle size={20} color="var(--warning)" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 14, color: 'var(--warning)', lineHeight: 1.4 }}>Hand over cash to the admin and submit to mark as pending verification.</span>
                  </div>
                )}
                <button className="btn btn-block mt-8" onClick={() => submitPayment(paymentMethod)} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit Payment'}</button>
                <button className="btn btn-ghost btn-block mt-8" onClick={() => setPaymentMethod('')} style={{ border: 'none' }}>← Back to methods</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
