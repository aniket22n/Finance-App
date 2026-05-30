import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  IoArrowBack, IoAdd, IoCalendarOutline, IoPeopleOutline, IoCardOutline,
  IoCheckmarkCircle, IoHourglassOutline, IoCloseCircle, IoTimeOutline, IoAlertCircle,
  IoCard, IoRefresh, IoWarningOutline, IoPlayCircleOutline, IoTrashOutline,
  IoShieldCheckmarkOutline, IoChevronForward, IoPerson,
} from 'react-icons/io5';
import { useAuth } from '../context/AuthContext';
import {
  getGroup, getCurrentCycle, getGroupPayments, getPaymentConfig,
  deleteGroup, sendOtp, verifyOtp, activateGroup, errMsg,
} from '../services/api';
import { useToast } from '../components/Toast';
import Spinner from '../components/Spinner';
import Empty from '../components/Empty';
import ProgressRing from '../components/ProgressRing';
import MemberCard from '../components/MemberCard';
import { inr } from '../utils/format';

const TIMELINE_STATUS = {
  verified: { color: '#10B981', bg: '#ECFDF5', label: 'Paid', Icon: IoCheckmarkCircle },
  paid:     { color: '#D97706', bg: '#FEF3C7', label: 'Awaiting', Icon: IoHourglassOutline },
  pending:  { color: '#D97706', bg: '#FFF8EE', label: 'Due Soon', Icon: IoTimeOutline },
  overdue:  { color: '#EF4444', bg: '#FEE2E2', label: 'Overdue', Icon: IoAlertCircle },
  rejected: { color: '#EF4444', bg: '#FEE2E2', label: 'Rejected', Icon: IoCloseCircle },
  upcoming: { color: '#9CA3AF', bg: 'transparent', label: 'Upcoming', Icon: null },
};

const HIST_STATUS = {
  pending:  { color: '#9CA3AF', label: 'Pending' },
  paid:     { color: '#F59E0B', label: 'Awaiting' },
  verified: { color: '#10B981', label: 'Verified' },
  failed:   { color: '#EF4444', label: 'Rejected' },
  rejected: { color: '#EF4444', label: 'Rejected' },
};

function fmtDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function StatItem({ label, value, accent }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: accent ? 'var(--primary)' : 'var(--text)' }}>{value}</div>
      <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{label}</div>
    </div>
  );
}

export default function GroupDetailPage() {
  const { id: groupId } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const toast = useToast();

  const [group, setGroup] = useState(null);
  const [cycle, setCycle] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('payments');
  const [timelineMember, setTimelineMember] = useState(null);

  // OTP flows
  const [otpMode, setOtpMode] = useState(null); // 'delete' | 'activate'
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const loadData = async () => {
    try {
      const [g, c, p] = await Promise.all([
        getGroup(groupId),
        getCurrentCycle(groupId).catch(() => ({ data: {} })),
        getGroupPayments(groupId).catch(() => ({ data: { payments: [] } })),
        getPaymentConfig().catch(() => ({ data: {} })),
      ]);
      setGroup(g.data.group || g.data);
      setCycle(c.data.cycle || null);
      setPayments(p.data.payments || p.data || []);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { loadData(); }, [groupId]); // eslint-disable-line

  const startOtp = async (mode) => {
    setSending(true);
    try {
      await sendOtp(user?.phone);
      setOtpCode(''); setOtpError(''); setOtpMode(mode);
    } catch {
      toast.error('Failed to send OTP. Try again.');
    } finally {
      setSending(false);
    }
  };

  const confirmOtp = async () => {
    if (otpCode.length < 4) { setOtpError('Enter the OTP sent to your phone'); return; }
    setVerifying(true); setOtpError('');
    try {
      await verifyOtp(user?.phone, otpCode);
      if (otpMode === 'delete') {
        await deleteGroup(groupId);
        setOtpMode(null);
        toast.success('Group deleted');
        setTimeout(() => navigate(-1), 700);
      } else {
        const res = await activateGroup(groupId);
        setOtpMode(null);
        toast.success('Group activated');
        if (res?.data?.status) setGroup((gr) => (gr ? { ...gr, status: res.data.status } : gr));
      }
    } catch (err) {
      const msg = (errMsg(err) || '').toLowerCase();
      if (msg.includes('otp') || msg.includes('invalid') || err?.response?.status === 400) setOtpError('Invalid OTP. Please try again.');
      else { toast.error(errMsg(err)); setOtpMode(null); }
    } finally {
      setVerifying(false);
    }
  };

  const handleActivatePress = () => {
    const memberCount = group?.members?.length || 0;
    const maxMembers = group?.maxMembers || 0;
    if (memberCount < maxMembers) {
      if (window.confirm(`Only ${memberCount} of ${maxMembers} members have been added. Once activated, no more members can be added. Activate anyway? (Cancel to add members first.)`)) {
        startOtp('activate');
      } else {
        navigate(`/admin/groups/${groupId}/add-members?mode=manage`);
      }
      return;
    }
    startOtp('activate');
  };

  if (loading) return <Spinner full />;
  if (!group) return <Empty title="Group not found" />;

  const winnerId = cycle?.winner?._id || cycle?.winner;
  const currentMonth = group.currentMonth || 0;
  const totalMonths = group.totalMonths || 1;
  const progress = (currentMonth / totalMonths) * 100;
  const isActive = group.status === 'active';
  const reducedEmi = group.reducedEmi ?? group.reducedEmiAmount;

  const myPayment = payments.find((p) => String(p.user?._id || p.user) === String(user?._id) && p.month === currentMonth);

  const winnerMonthByMember = new Map();
  for (const c of group.monthlyConfig || []) {
    if (c.month <= currentMonth && c.winner) winnerMonthByMember.set(String(c.winner), c.month);
  }
  const currentWinnerKey = winnerId ? String(winnerId) : '';
  const sortedMembers = [...(group.members || [])].sort((a, b) => {
    const ma = winnerMonthByMember.get(String(a._id)), mb = winnerMonthByMember.get(String(b._id));
    if (ma && mb) return ma - mb;
    if (ma) return -1;
    if (mb) return 1;
    return 0;
  });

  const renderMember = (member, clickable) => {
    const memberPayment = payments.find((p) => (p.user?._id || p.user) === member._id && p.month === currentMonth);
    const wonMonth = winnerMonthByMember.get(String(member._id)) || null;
    const isWinner = !!currentWinnerKey && String(member._id) === currentWinnerKey;
    const isPastWinner = !!wonMonth && !isWinner;
    return (
      <MemberCard
        key={member._id}
        member={member}
        isWinner={isWinner}
        isPastWinner={isPastWinner}
        winnerMonth={wonMonth}
        paymentStatus={memberPayment?.status}
        emiAmount={(isWinner || isPastWinner) ? group.emiAmount : reducedEmi}
        onClick={clickable ? () => setTimelineMember(member) : undefined}
      />
    );
  };

  return (
    <div style={{ background: 'var(--background-secondary)', minHeight: '100%' }}>
      <header className="app-header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ border: 'none', padding: 0 }}>
          <IoArrowBack size={18} /> Group Details
        </button>
      </header>

      {/* Info card */}
      <div className="screen">
        <div className="card">
          <div className="row between" style={{ alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ flex: 1, paddingRight: 12 }}>
              <h1 style={{ fontSize: 20, marginBottom: 8 }}>{group.name}</h1>
              <span className={`badge ${isActive ? 'badge-green' : 'badge-amber'}`}>{group.status?.toUpperCase()}</span>
            </div>
            <ProgressRing progress={progress} size={80} stroke={7} centerText={`${currentMonth}/${totalMonths}`} />
          </div>
          <div className="row" style={{ paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <StatItem label="Pot Amount" value={inr(group.potAmount)} accent />
            <div style={{ width: 1, height: 32, background: 'var(--border)' }} />
            <StatItem label="Winner EMI" value={inr(group.emiAmount)} />
            <div style={{ width: 1, height: 32, background: 'var(--border)' }} />
            <StatItem label="Reducing EMI" value={inr(reducedEmi)} />
          </div>
        </div>
      </div>

      {/* ── Admin: members directly ── */}
      {isAdmin ? (
        <div className="screen" style={{ paddingTop: 12 }}>
          <div className="row between" style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 500 }}>Members ({group.members?.length || 0}/{group.maxMembers})</span>
            <button className="center" style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary-light)', border: '1px solid var(--primary)', cursor: 'pointer' }}
              onClick={() => navigate(`/admin/groups/${groupId}/add-members?mode=manage`)}>
              <IoAdd size={20} color="var(--primary)" />
            </button>
          </div>
          {sortedMembers.map((m) => renderMember(m, true))}

          {/* Activate (pending) */}
          {group.status === 'pending' && (() => {
            const memberCount = group.members?.length || 0;
            const maxMembers = group.maxMembers || 0;
            const isFull = memberCount >= maxMembers;
            return (
              <div style={{ marginTop: 12 }}>
                <div className="row gap-6" style={{ marginBottom: 8, color: isFull ? 'var(--success)' : 'var(--warning)' }}>
                  {isFull ? <IoCheckmarkCircle size={16} /> : <IoPeopleOutline size={16} />}
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{memberCount}/{maxMembers} members added</span>
                </div>
                {!isFull && (
                  <div className="card mb-12 row gap-6" style={{ background: 'var(--warning-light)', borderColor: 'var(--warning)', alignItems: 'flex-start' }}>
                    <IoWarningOutline size={14} color="var(--warning)" style={{ marginTop: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--warning)', lineHeight: 1.4 }}>
                      Add all {maxMembers} members before activating. Once activated, the member list is locked and no new members can be added.
                    </span>
                  </div>
                )}
                <button className="btn btn-block" onClick={handleActivatePress} disabled={sending}>
                  <IoPlayCircleOutline size={18} /> {sending ? 'Sending…' : 'Activate Group'}
                </button>
              </div>
            );
          })()}

          {/* Delete */}
          <button className="btn btn-danger btn-block" style={{ marginTop: 12 }} onClick={() => startOtp('delete')} disabled={sending}>
            <IoTrashOutline size={18} /> Delete Group
          </button>
        </div>
      ) : (
        <>
          {/* ── Member: tabs ── */}
          <div className="screen" style={{ paddingTop: 4 }}>
            <div className="row" style={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              {[['payments', 'Payments', IoCalendarOutline], ['members', 'Members', IoPeopleOutline]].map(([key, label, Ic]) => (
                <button key={key} onClick={() => setActiveTab(key)}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 0',
                    background: activeTab === key ? 'var(--primary-light)' : 'none', border: 'none', cursor: 'pointer',
                    borderBottom: `2px solid ${activeTab === key ? 'var(--primary)' : 'transparent'}`,
                    color: activeTab === key ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: 500, fontSize: 14,
                  }}>
                  <Ic size={16} /> {label}
                </button>
              ))}
            </div>
          </div>

          {activeTab === 'payments' ? (
            <div className="screen" style={{ paddingTop: 12 }}>
              {/* Pay Now card */}
              {isActive && (() => {
                const isRejected = myPayment?.status === 'rejected' || myPayment?.status === 'failed';
                const isPaid = myPayment?.status === 'paid';
                const isVerified = myPayment?.status === 'verified';
                const accent = isRejected ? '#EF4444' : isPaid ? '#D97706' : isVerified ? '#10B981' : 'var(--primary)';
                const Ic = isRejected ? IoCloseCircle : isPaid ? IoHourglassOutline : isVerified ? IoCheckmarkCircle : IoCardOutline;
                const canPay = !myPayment || myPayment.status === 'pending' || isRejected;
                return (
                  <button className="card row gap-10 mb-12" style={{ borderLeft: `3px solid ${accent}`, width: '100%', textAlign: 'left', cursor: canPay ? 'pointer' : 'default', alignItems: 'center' }}
                    onClick={canPay ? () => navigate(`/pay/${groupId}`) : undefined}>
                    <span className="center" style={{ width: 34, height: 34, borderRadius: 9, background: `color-mix(in srgb, ${accent} 15%, transparent)`, flexShrink: 0 }}><Ic size={18} color={accent} /></span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>
                        Month {currentMonth}{isVerified ? ' · Paid ✓' : isPaid ? ' · Awaiting verification' : isRejected ? ' · Rejected' : ' · Payment due'}
                      </span>
                      <span className="muted" style={{ display: 'block', fontSize: 12, marginTop: 1 }}>{inr(myPayment?.amount || group.emiAmount)}</span>
                    </span>
                    {canPay && (
                      <span className="row gap-4" style={{ background: accent, color: '#fff', padding: '7px 11px', borderRadius: 8, fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                        {isRejected ? <IoRefresh size={13} /> : <IoCard size={13} />} {isRejected ? 'Resubmit' : 'Pay Now'}
                      </span>
                    )}
                  </button>
                );
              })()}

              <div style={{ fontSize: 15, fontWeight: 600, marginTop: 12 }}>Payment Timeline</div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>Track all payments for the group</div>

              {Array.from({ length: totalMonths }, (_, i) => i + 1).map((month) => {
                const myPmt = payments.find((p) => String(p.user?._id || p.user) === String(user?._id) && p.month === month);
                const isCurrentMonth = month === currentMonth;
                const isFuture = month > currentMonth;
                let statusKey = 'upcoming';
                if (!isFuture) statusKey = myPmt ? (myPmt.status === 'failed' ? 'rejected' : myPmt.status) : (isCurrentMonth ? 'pending' : 'overdue');
                const ST = TIMELINE_STATUS[statusKey] || TIMELINE_STATUS.upcoming;
                const isLast = month === totalMonths;
                const date = myPmt?.paidAt || myPmt?.createdAt;
                const amt = myPmt?.amount || group.emiAmount;
                const dotColor = isFuture ? 'var(--background-tertiary)'
                  : (statusKey === 'rejected' || statusKey === 'overdue') ? '#EF4444' : statusKey === 'pending' ? '#D97706' : '#10B981';
                return (
                  <div key={month} className={`tl-row ${isCurrentMonth ? 'tl-row-current' : ''}`} style={{ cursor: myPmt ? 'pointer' : 'default' }}
                    onClick={() => { if (myPmt) navigate(`/payments/${myPmt._id}`, { state: { payment: { ...myPmt, group } } }); }}>
                    <div className="tl-spine">
                      <span className="tl-dot" style={{ background: dotColor, color: isFuture ? 'var(--text-tertiary)' : '#fff' }}>{month}</span>
                      {!isLast && <span className="tl-line" style={{ background: isFuture ? 'var(--border)' : 'color-mix(in srgb, var(--primary) 35%, transparent)' }} />}
                    </div>
                    <div className="tl-inner">
                      {isFuture ? (
                        <span className="faint" style={{ fontSize: 14, fontWeight: 600 }}>Month {month}</span>
                      ) : (
                        <>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>Month {month}{isCurrentMonth ? ' (Current)' : ''}</div>
                            {date && <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{fmtDate(date)}</div>}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>{inr(amt)}</div>
                            <span className="row gap-4" style={{ background: ST.bg, border: `1px solid color-mix(in srgb, ${ST.color} 50%, transparent)`, padding: '3px 8px', borderRadius: 6, color: ST.color, fontSize: 11, fontWeight: 500 }}>
                              {ST.Icon && <ST.Icon size={11} />} {ST.label}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="screen" style={{ paddingTop: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>Members ({group.members?.length || 0}/{group.maxMembers})</div>
              {sortedMembers.map((m) => renderMember(m, false))}
            </div>
          )}
        </>
      )}

      <div style={{ height: 24 }} />

      {/* OTP modal (delete / activate) */}
      {otpMode && (
        <div className="modal-backdrop" onMouseDown={() => !verifying && setOtpMode(null)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 380, textAlign: 'center' }}>
            <div className="center" style={{ width: 64, height: 64, borderRadius: 32, margin: '0 auto 16px', background: otpMode === 'delete' ? 'var(--error-light)' : 'var(--primary-light)' }}>
              {otpMode === 'delete' ? <IoShieldCheckmarkOutline size={32} color="var(--error)" /> : <IoPlayCircleOutline size={32} color="var(--primary)" />}
            </div>
            <h3 style={{ fontSize: 18, marginBottom: 8 }}>{otpMode === 'delete' ? 'Confirm Delete' : 'Confirm Activation'}</h3>
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 20 }}>
              Enter the OTP sent to +91 {user?.phone} to {otpMode === 'delete' ? 'confirm deletion.' : 'activate this group.'}
            </p>
            <input className="input" style={{ textAlign: 'center', letterSpacing: 8, fontWeight: 700, fontSize: 20, ...(otpError ? { borderColor: 'var(--error)' } : {}) }}
              inputMode="numeric" maxLength={6} value={otpCode} autoFocus placeholder="Enter OTP"
              onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, '')); setOtpError(''); }} />
            {otpError && <div className="row gap-4 mt-8" style={{ justifyContent: 'center', color: 'var(--error)', fontSize: 12 }}><IoAlertCircle size={13} /> {otpError}</div>}
            <button className="btn btn-block mt-12" style={otpMode === 'delete' ? { background: 'var(--error)', color: '#fff', border: 'none' } : undefined} onClick={confirmOtp} disabled={verifying}>
              {verifying ? 'Working…' : otpMode === 'delete' ? 'Confirm Delete' : 'Activate Group'}
            </button>
            <button className="btn btn-ghost btn-block mt-8" onClick={() => setOtpMode(null)} disabled={verifying}>Cancel</button>
          </div>
        </div>
      )}

      {/* Member payment-history overlay (admin) */}
      {timelineMember && (() => {
        const real = payments.filter((p) => (p.user?._id || p.user) === timelineMember._id).sort((a, b) => a.month - b.month);
        const totalPaid = real.filter((p) => p.status === 'verified' || p.status === 'paid').length;
        const totalAmt = real.filter((p) => p.status === 'verified' || p.status === 'paid').reduce((s, p) => s + (p.amount || 0), 0);
        return (
          <div className="tl-overlay">
            <div className="row gap-12" style={{ padding: '20px 16px 10px', borderBottom: '1px solid var(--border)' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setTimelineMember(null)} style={{ border: 'none', padding: 0 }}><IoArrowBack size={22} /></button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>Payment History</div>
                <div className="muted" style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.name}</div>
              </div>
            </div>
            <div className="phone-content" style={{ padding: 16 }}>
              <div className="card row gap-10 mb-16" style={{ background: 'var(--background-secondary)' }}>
                <span className="center" style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border)', flexShrink: 0 }}><IoPerson size={16} color="var(--text-secondary)" /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{timelineMember.name || timelineMember.phone}</div>
                  {timelineMember.name && timelineMember.phone && <div className="muted" style={{ fontSize: 11 }}>{timelineMember.phone}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>{inr(totalAmt)}</div>
                  <div className="muted" style={{ fontSize: 10 }}>{totalPaid} paid</div>
                </div>
              </div>

              {real.length === 0 ? (
                <Empty icon={<IoCardOutline size={40} />} title="No payments yet" />
              ) : real.map((p, idx) => {
                const st = HIST_STATUS[p.status] || HIST_STATUS.pending;
                const isLast = idx === real.length - 1;
                const date = p.paidAt || p.createdAt;
                return (
                  <div key={p._id} className="tl-row" onClick={() => navigate(`/admin/payments/${p._id}`, { state: { payment: p } })} style={{ paddingLeft: 0 }}>
                    <div className="tl-spine" style={{ width: 20, paddingTop: 18 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 5, background: st.color, flexShrink: 0 }} />
                      {!isLast && <span className="tl-line" style={{ background: 'var(--border)', minHeight: 28 }} />}
                    </div>
                    <div className="tl-inner" style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>Month {p.month}</div>
                        {date && <div className="muted" style={{ fontSize: 11 }}>{fmtDate(date)}  ·  {(p.paymentMethod || 'UPI').toUpperCase()}</div>}
                      </div>
                      <div className="row gap-4">
                        <span style={{ fontSize: 14, fontWeight: 700, color: st.color }}>{inr(p.amount || 0)}</span>
                        <IoChevronForward size={14} color="var(--text-tertiary)" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
