import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IoCalendarOutline, IoNotificationsOutline, IoAlarmOutline, IoDocumentTextOutline,
  IoPeopleOutline, IoArchiveOutline, IoChevronForward, IoArrowBack, IoWarningOutline,
  IoSettingsOutline, IoClose,
} from 'react-icons/io5';
import {
  getGroups, getEligibleMembers, createEmiCycle, getPlannedWinner,
  sendBulkNotification, triggerReminders, getPendingAccountRequests, errMsg,
} from '../../services/api';
import { useToast } from '../../components/Toast';
import { inr } from '../../utils/format';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function computeMonthName(group, monthOffset) {
  if (!group || !monthOffset) return '';
  const base = group.startDate || group.createdAt ? new Date(group.startDate || group.createdAt) : new Date();
  const d = new Date(base.getFullYear(), base.getMonth() + (monthOffset - 1), 1);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

// ── A single tappable row inside a grouped card ──
function ActionRow({ Icon, color, title, subtitle, onClick, badge, isLast }) {
  return (
    <button
      className="ctrl-row"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%',
        padding: '12px', background: 'none', border: 'none', textAlign: 'left',
        borderBottom: isLast ? 'none' : '1px solid var(--border)', cursor: 'pointer',
      }}
    >
      <span style={{ width: 32, display: 'flex', justifyContent: 'center', color }}><Icon size={24} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
        <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>{subtitle}</span>
      </span>
      {badge ? <span className="badge badge-amber">{badge}</span> : null}
      <IoChevronForward size={16} color="var(--text-tertiary)" />
    </button>
  );
}

function Section({ title, children }) {
  return (
    <>
      <div className="section-title" style={{ marginTop: 24 }}>{title}</div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>{children}</div>
    </>
  );
}

// Centered modal shell (web equivalent of the mobile bottom sheet).
function Sheet({ title, onClose, children, footer }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="row between mb-16">
          <h3 style={{ fontSize: 18 }}>{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><IoClose size={18} /></button>
        </div>
        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>{children}</div>
        {footer}
      </div>
    </div>
  );
}

export default function AdminControlsPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [pendingCount, setPendingCount] = useState(0);
  const [allGroups, setAllGroups] = useState([]);

  useEffect(() => {
    getPendingAccountRequests().then((r) => setPendingCount(r.data.requests?.length || 0)).catch(() => {});
    getGroups().then((r) => setAllGroups(r.data.groups || r.data || [])).catch(() => {});
  }, []);

  // ── Run Draw ──
  const [showCycle, setShowCycle] = useState(false);
  const [cycleStep, setCycleStep] = useState(1);
  const [cycleGroupId, setCycleGroupId] = useState('');
  const [eligible, setEligible] = useState([]);
  const [winnerId, setWinnerId] = useState('');
  const [loadingEligible, setLoadingEligible] = useState(false);
  const [creatingCycle, setCreatingCycle] = useState(false);
  const [plannedWinnerId, setPlannedWinnerId] = useState(null);
  const [plannedNextMonth, setPlannedNextMonth] = useState(null);
  const [plannedEmiAmount, setPlannedEmiAmount] = useState(null);
  const [plannedReducedEmi, setPlannedReducedEmi] = useState(null);
  const [cycleReducedEmi, setCycleReducedEmi] = useState('');
  const [noPlanGroup, setNoPlanGroup] = useState(null);

  const openCycle = () => {
    setCycleStep(1); setCycleGroupId(''); setEligible([]); setWinnerId('');
    setPlannedWinnerId(null); setPlannedNextMonth(null); setPlannedEmiAmount(null);
    setPlannedReducedEmi(null); setCycleReducedEmi(''); setNoPlanGroup(null);
    setShowCycle(true);
  };

  const selectCycleGroup = async (groupId) => {
    setCycleGroupId(groupId);
    setLoadingEligible(true);
    try {
      const [eligibleRes, planRes] = await Promise.all([
        getEligibleMembers(groupId),
        getPlannedWinner(groupId).catch(() => ({ data: {} })),
      ]);
      const members = eligibleRes.data.members || [];
      setEligible(members);
      const planned = planRes.data?.plannedWinnerId || null;
      const nextMonth = planRes.data?.nextMonth || null;
      if (!planned) { setNoPlanGroup({ groupId, nextMonth }); return; }
      setNoPlanGroup(null);
      setPlannedWinnerId(planned);
      setPlannedNextMonth(nextMonth);
      setPlannedEmiAmount(planRes.data?.plannedEmiAmount ?? null);
      setPlannedReducedEmi(planRes.data?.plannedReducedEmi ?? null);
      setWinnerId(members.some((m) => String(m._id) === String(planned)) ? planned : '');
      setCycleStep(2);
    } catch {
      toast.error('Failed to load eligible members');
    } finally {
      setLoadingEligible(false);
    }
  };

  const goToCycleConfirm = () => {
    if (!winnerId) return;
    const group = allGroups.find((g) => g._id === cycleGroupId);
    const defaultReduced = plannedReducedEmi ?? group?.reducedEmi ?? '';
    setCycleReducedEmi(String(defaultReduced || ''));
    setCycleStep(3);
  };

  const submitCycle = async () => {
    if (!cycleGroupId || !winnerId) return;
    const re = Number(cycleReducedEmi);
    if (!Number.isFinite(re) || re <= 0) return toast.error('Reducing EMI must be a positive number');
    setCreatingCycle(true);
    try {
      await createEmiCycle({ groupId: cycleGroupId, winnerId, reducedEmi: re });
      setShowCycle(false);
      toast.success('Cycle created and members notified');
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setCreatingCycle(false);
    }
  };

  // ── Bulk Notify ──
  const [showNotify, setShowNotify] = useState(false);
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyBody, setNotifyBody] = useState('');
  const [notifyGroupId, setNotifyGroupId] = useState('');
  const [sending, setSending] = useState(false);

  const openNotify = () => { setNotifyTitle(''); setNotifyBody(''); setNotifyGroupId(''); setShowNotify(true); };
  const submitNotify = async () => {
    if (!notifyTitle.trim() || !notifyBody.trim()) return toast.error('Enter both title and message');
    setSending(true);
    try {
      const payload = { title: notifyTitle.trim(), body: notifyBody.trim() };
      if (notifyGroupId) payload.groupId = notifyGroupId;
      const res = await sendBulkNotification(payload);
      setShowNotify(false);
      toast.success(`Sent to ${res.data.sent || 0} members`);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSending(false);
    }
  };

  const handleTriggerReminders = async () => {
    if (!window.confirm('Send EMI payment reminders to all members with pending payments?')) return;
    try {
      await triggerReminders();
      toast.success('Reminders sent to all members');
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const activeGroups = allGroups.filter((g) => g.status === 'active');

  return (
    <div>
      <header className="app-header"><h1>Admin Controls</h1></header>

      <div className="screen" style={{ maxWidth: 640, margin: '0 auto' }}>
        <Section title="MONTHLY DRAW">
          <ActionRow Icon={IoCalendarOutline} color="var(--primary)" title="Run This Month's Draw"
            subtitle="Execute the cycle for the next month (uses your POT Plan)" onClick={openCycle} isLast />
        </Section>

        <Section title="NOTIFICATIONS">
          <ActionRow Icon={IoNotificationsOutline} color="var(--warning)" title="Bulk Notify Members"
            subtitle="Send a push message to all members or a specific group" onClick={openNotify} />
          <ActionRow Icon={IoAlarmOutline} color="var(--primary)" title="Trigger EMI Reminders"
            subtitle="Manually run the reminder scheduler" onClick={handleTriggerReminders} isLast />
        </Section>

        <Section title="USER MANAGEMENT">
          <ActionRow Icon={IoDocumentTextOutline} color="var(--warning)" title="Account Requests"
            subtitle="Review and approve new member sign-up requests"
            badge={pendingCount > 0 ? String(pendingCount) : null}
            onClick={() => navigate('/admin/requests')} />
          <ActionRow Icon={IoPeopleOutline} color="var(--success)" title="Manage Users"
            subtitle="View and remove members" onClick={() => navigate('/admin/users')} isLast />
        </Section>

        <Section title="APP SETTINGS">
          <ActionRow Icon={IoArchiveOutline} color="var(--info)" title="Backup & Export"
            subtitle="Export all data as JSON (coming soon)"
            onClick={() => toast.show('Coming soon — backup will be available in a future update.', 'info')} isLast />
        </Section>
      </div>

      {/* ── Run Draw modal ── */}
      {showCycle && (
        <Sheet
          title={cycleStep === 1 ? 'Run Draw: Select Group' : cycleStep === 2 ? 'Run Draw: Pick Winner' : 'Run Draw: Confirm'}
          onClose={() => setShowCycle(false)}
          footer={
            cycleStep === 2 && winnerId ? (
              <button className="btn btn-block mt-16" onClick={goToCycleConfirm}>Continue</button>
            ) : cycleStep === 3 ? (
              <button className="btn btn-block mt-16" onClick={submitCycle} disabled={creatingCycle}>
                {creatingCycle ? 'Working…' : 'Confirm & Run Draw'}
              </button>
            ) : null
          }
        >
          {cycleStep === 1 ? (
            activeGroups.length === 0 ? (
              <p className="muted" style={{ textAlign: 'center', padding: 20 }}>No active groups found</p>
            ) : (
              <>
                {activeGroups.map((g) => {
                  const active = cycleGroupId === g._id;
                  return (
                    <button key={g._id} className={`select-row ${active ? 'active' : ''}`} onClick={() => selectCycleGroup(g._id)} disabled={loadingEligible}>
                      <div style={{ fontWeight: 600 }}>{g.name}</div>
                      <div className="faint" style={{ fontSize: 12, marginTop: 3 }}>
                        Month {g.currentMonth}/{g.totalMonths} · {g.members?.length || 0} members
                        {loadingEligible && active ? ' · loading…' : ''}
                      </div>
                    </button>
                  );
                })}
                {noPlanGroup && (
                  <div className="card mt-12" style={{ background: 'var(--warning-light)', borderColor: 'var(--warning)' }}>
                    <div className="row gap-6 mb-8"><IoWarningOutline size={18} color="var(--warning)" /><b style={{ color: 'var(--warning)' }}>POT Plan Required</b></div>
                    <p style={{ fontSize: 12, color: 'var(--warning)', lineHeight: 1.5, marginBottom: 12 }}>
                      Month {noPlanGroup.nextMonth ?? '?'} has no planned winner. Configure the POT plan for this group before running the draw.
                    </p>
                    <button className="btn btn-outline btn-sm" onClick={() => { setShowCycle(false); navigate(`/admin/groups/${noPlanGroup.groupId}/pot`); }}>
                      <IoSettingsOutline size={14} /> Open POT Plan
                    </button>
                  </div>
                )}
              </>
            )
          ) : cycleStep === 2 ? (
            <>
              <button className="btn btn-ghost btn-sm mb-12" onClick={() => { setCycleStep(1); setWinnerId(''); }} style={{ border: 'none', padding: 0, color: 'var(--primary)' }}>
                <IoArrowBack size={14} /> Change group
              </button>
              {plannedNextMonth && (
                <div className="badge badge-purple mb-12" style={{ display: 'block', padding: 8, lineHeight: 1.4 }}>
                  {plannedWinnerId
                    ? `Planned winner pre-selected for Month ${plannedNextMonth}. Tap another name to override.`
                    : `No POT plan for Month ${plannedNextMonth} — pick a winner manually.`}
                </div>
              )}
              {eligible.length === 0 ? (
                <p className="muted" style={{ textAlign: 'center', padding: 20 }}>No eligible members — all have won already</p>
              ) : (
                eligible.map((m) => {
                  const isPlanned = plannedWinnerId && String(plannedWinnerId) === String(m._id);
                  const active = winnerId === m._id;
                  return (
                    <button key={m._id} className={`select-row ${active ? 'active' : ''}`} onClick={() => setWinnerId(m._id)}>
                      <div className="row gap-8">
                        <span style={{ fontWeight: 600 }}>{m.name || m.phone}</span>
                        {isPlanned && <span className="badge badge-purple">Planned</span>}
                      </div>
                      <div className="faint" style={{ fontSize: 12, marginTop: 3 }}>{m.phone}</div>
                    </button>
                  );
                })
              )}
            </>
          ) : (
            (() => {
              const group = allGroups.find((g) => g._id === cycleGroupId);
              const winner = eligible.find((m) => m._id === winnerId);
              const monthName = computeMonthName(group, plannedNextMonth);
              const winnerEmi = plannedEmiAmount ?? group?.emiAmount;
              return (
                <>
                  <button className="btn btn-ghost btn-sm mb-12" onClick={() => setCycleStep(2)} style={{ border: 'none', padding: 0, color: 'var(--primary)' }}>
                    <IoArrowBack size={14} /> Change winner
                  </button>
                  <div className="card mb-16" style={{ background: 'var(--primary-light)', borderColor: 'var(--primary)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--primary)' }}>POT WINNER FOR</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary-dark)' }}>Month {plannedNextMonth}{monthName ? ` · ${monthName}` : ''}</div>
                    <div className="divider" style={{ background: 'var(--primary)', opacity: 0.25 }} />
                    <div className="row gap-12">
                      <span className="center" style={{ width: 44, height: 44, borderRadius: 22, background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 18 }}>
                        {(winner?.name || winner?.phone || '?').charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--primary-dark)' }}>{winner?.name || 'Unknown'}</div>
                        <div style={{ fontSize: 12, color: 'var(--primary-dark)', opacity: 0.75 }}>+91 {winner?.phone}</div>
                      </div>
                    </div>
                  </div>
                  <div className="field">
                    <label>Winner EMI (fixed for this winner)</label>
                    <div className="input row" style={{ alignItems: 'center', fontWeight: 600 }}>{inr(winnerEmi)}</div>
                  </div>
                  <div className="field">
                    <label>Reducing EMI for non-winners (this month)</label>
                    <input className="input" inputMode="numeric" value={cycleReducedEmi}
                      onChange={(e) => setCycleReducedEmi(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0" />
                    <div className="faint" style={{ fontSize: 11, marginTop: 4 }}>
                      Default {plannedReducedEmi != null ? 'from POT plan' : 'from group config'}. Edit to override for this draw only.
                    </div>
                  </div>
                </>
              );
            })()
          )}
        </Sheet>
      )}

      {/* ── Bulk Notify modal ── */}
      {showNotify && (
        <Sheet
          title="Send Notification"
          onClose={() => setShowNotify(false)}
          footer={<button className="btn btn-block mt-16" onClick={submitNotify} disabled={sending}>{sending ? 'Sending…' : 'Send to Members'}</button>}
        >
          <div className="field">
            <label>Title *</label>
            <input className="input" value={notifyTitle} onChange={(e) => setNotifyTitle(e.target.value)} placeholder="e.g. EMI Reminder" />
          </div>
          <div className="field">
            <label>Message * (max 160 chars)</label>
            <textarea className="input" rows={3} value={notifyBody} onChange={(e) => setNotifyBody(e.target.value.slice(0, 160))} placeholder="Your message here…" />
            <div className="faint" style={{ fontSize: 11, textAlign: 'right', marginTop: 4 }}>{notifyBody.length}/160</div>
          </div>
          <div className="field">
            <label>Target Group (optional)</label>
            <div className="row gap-8 wrap mt-4">
              <button className={`btn btn-sm ${!notifyGroupId ? '' : 'btn-ghost'}`} onClick={() => setNotifyGroupId('')}>All Members</button>
              {allGroups.map((g) => (
                <button key={g._id} className={`btn btn-sm ${notifyGroupId === g._id ? '' : 'btn-ghost'}`} onClick={() => setNotifyGroupId(g._id)}>{g.name}</button>
              ))}
            </div>
          </div>
        </Sheet>
      )}
    </div>
  );
}
