import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  IoChevronBack, IoInformationCircleOutline, IoChevronDown, IoChevronUp,
  IoCloseCircleOutline, IoCheckmark, IoAlertCircleOutline, IoClose,
} from 'react-icons/io5';
import { getGroup, configurePot, errMsg } from '../../services/api';
import { useToast } from '../../components/Toast';
import Spinner from '../../components/Spinner';
import { inr } from '../../utils/format';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function calculateMonthName(startDate, monthOffset) {
  const base = startDate ? new Date(startDate) : new Date();
  const d = new Date(base.getFullYear(), base.getMonth() + (monthOffset - 1), 1);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}
const isLockedMonth = (currentMonth, month) => month <= (currentMonth || 0);

function SummaryTile({ label, value, accent }) {
  return (
    <div style={{ flex: 1, padding: '8px 4px' }}>
      <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: accent ? 'var(--primary)' : 'var(--text)' }}>{value}</div>
    </div>
  );
}

export default function AdminPOTWinnerConfigPage() {
  const { id: groupId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState([]);

  const [pickerMonth, setPickerMonth] = useState(null);
  const [warn, setWarn] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getGroup(groupId);
        if (cancelled) return;
        const g = res.data.group || res.data;
        setGroup(g);
        const totalMonths = g.totalMonths || 0;
        const startDate = g.startDate || g.createdAt;
        const existing = Array.isArray(g.monthlyConfig) ? g.monthlyConfig : [];
        const byKey = new Map(existing.map((c) => [c.month, c]));
        const activeMonth = (g.currentMonth || 0) + 1;
        setRows(Array.from({ length: totalMonths }, (_, i) => {
          const month = i + 1;
          const prev = byKey.get(month);
          return {
            month,
            monthName: calculateMonthName(startDate, month),
            selectedWinner: prev?.winner ? (typeof prev.winner === 'object' ? prev.winner._id : prev.winner) : '',
            winnerEMI: prev?.emiAmount != null ? String(prev.emiAmount) : String(g.emiAmount || ''),
            otherMemberEMI: prev?.reducedEmi != null ? String(prev.reducedEmi) : String(g.reducedEmi || ''),
            locked: isLockedMonth(g.currentMonth, month),
            current: month === activeMonth,
          };
        }));
      } catch (err) {
        toast.error(errMsg(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [groupId, toast]);

  const updateRow = (month, patch) => setRows((prev) => prev.map((r) => (r.month === month ? { ...r, ...patch } : r)));

  const members = group?.members || [];
  const memberLabel = (id) => {
    const m = members.find((x) => String(x._id) === String(id));
    return m ? (m.name || m.phone) : 'Select…';
  };

  const persistConfig = async (payload) => {
    setSaving(true);
    try {
      await configurePot(groupId, payload);
      setWarn(null);
      toast.success('POT configured successfully');
      setTimeout(() => navigate(`/admin/groups/${groupId}`, { replace: true }), 600);
    } catch (err) {
      setWarn(null);
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const filled = rows.filter((r) => !r.locked && r.selectedWinner);
    for (const r of filled) {
      const w = Number(r.winnerEMI), o = Number(r.otherMemberEMI);
      if (!Number.isFinite(w) || w <= 0) return toast.show(`Winner EMI for ${r.monthName} must be positive`, 'info');
      if (!Number.isFinite(o) || o <= 0) return toast.show(`Reducing EMI for ${r.monthName} must be positive`, 'info');
    }
    if (filled.length === 0) return toast.show('Select a winner for at least one month', 'info');

    const payload = filled.map((r) => ({
      month: r.month, selectedWinner: r.selectedWinner,
      winnerEMI: Number(r.winnerEMI), otherMemberEMI: Number(r.otherMemberEMI),
    }));
    const groupWinnerEmi = Number(group?.emiAmount);
    const divergent = filled
      .filter((r) => Number(r.winnerEMI) !== groupWinnerEmi)
      .map((r) => ({ month: r.month, monthName: r.monthName, winnerEMI: Number(r.winnerEMI) }));
    if (Number.isFinite(groupWinnerEmi) && divergent.length > 0) return setWarn({ payload, divergent, groupWinnerEmi });
    await persistConfig(payload);
  };

  if (loading) return <Spinner full />;

  // Winner picker available members (hide ones taken by other months)
  const pickerData = (() => {
    if (!pickerMonth) return { currentPick: '', available: [] };
    const currentPick = rows.find((r) => r.month === pickerMonth)?.selectedWinner || '';
    const taken = new Set(rows.filter((r) => r.month !== pickerMonth && r.selectedWinner).map((r) => String(r.selectedWinner)));
    return { currentPick, available: members.filter((m) => !taken.has(String(m._id))) };
  })();

  return (
    <div>
      <header className="app-header">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ border: 'none', padding: 0, marginBottom: 4 }}>
            <IoChevronBack size={18} /> Groups
          </button>
          <h1 style={{ fontSize: 20 }}>Configure POT Winners</h1>
          <button onClick={() => setSummaryOpen((v) => !v)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
            {group?.name} {summaryOpen ? <IoChevronUp size={14} /> : <IoChevronDown size={14} />}
          </button>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowInfo(true)} style={{ border: 'none' }}>
          <IoInformationCircleOutline size={22} color="var(--primary)" />
        </button>
      </header>

      <div className="screen" style={{ paddingBottom: 96 }}>
        {summaryOpen && (
          <div className="card mb-12" style={{ background: 'var(--background-secondary)' }}>
            <div className="row">
              <SummaryTile label="POT Amount" value={inr(group?.potAmount)} accent />
              <SummaryTile label="Members" value={String(group?.members?.length || 0)} />
            </div>
            <div className="row">
              <SummaryTile label="Duration" value={`${group?.totalMonths || 0} months`} />
              <SummaryTile label="Fixed EMI (Winner)" value={inr(group?.emiAmount)} />
            </div>
          </div>
        )}

        <table className="pot-tbl">
          <colgroup>
            <col style={{ width: '9%' }} /><col style={{ width: '17%' }} />
            <col style={{ width: '30%' }} /><col style={{ width: '22%' }} /><col style={{ width: '22%' }} />
          </colgroup>
          <thead>
            <tr><th style={{ textAlign: 'center' }}>Mo.</th><th>Month</th><th>POT Winner</th><th>Winner EMI</th><th>Reducing EMI</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month} style={r.current ? { background: 'var(--primary-light)', boxShadow: 'inset 3px 0 0 var(--primary)' } : r.locked ? { opacity: 0.6 } : undefined}>
                <td style={{ textAlign: 'center' }}>{r.month}</td>
                <td style={{ fontSize: 11 }}>{r.monthName}</td>
                <td>
                  <button className="pot-cell row between" style={{ cursor: r.locked ? 'default' : 'pointer' }} disabled={r.locked} onClick={() => setPickerMonth(r.month)}>
                    <span style={{ color: r.selectedWinner ? 'var(--text)' : 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.selectedWinner ? memberLabel(r.selectedWinner) : 'Select…'}
                    </span>
                    {!r.locked && <IoChevronDown size={11} color="var(--text-secondary)" style={{ flexShrink: 0 }} />}
                  </button>
                </td>
                <td>
                  <input className="pot-cell" inputMode="numeric" value={r.winnerEMI} disabled={r.locked} placeholder="0"
                    onChange={(e) => updateRow(r.month, { winnerEMI: e.target.value.replace(/[^0-9.]/g, '') })} />
                </td>
                <td>
                  <input className="pot-cell" inputMode="numeric" value={r.otherMemberEMI} disabled={r.locked} placeholder="0"
                    onChange={(e) => updateRow(r.month, { otherMemberEMI: e.target.value.replace(/[^0-9.]/g, '') })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Save footer */}
      <div style={{ position: 'sticky', bottom: 0, padding: 16, background: 'var(--background)', borderTop: '1px solid var(--border)' }}>
        <button className="btn btn-block" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save POT Config'}</button>
      </div>

      {/* Winner picker */}
      {pickerMonth && (
        <div className="modal-backdrop" onMouseDown={() => setPickerMonth(null)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h3 style={{ fontSize: 14, marginBottom: 12 }}>Select Winner</h3>
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {pickerData.currentPick && (
                <button className="row gap-8" style={{ width: '100%', padding: 12, background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', color: 'var(--error)' }}
                  onClick={() => { updateRow(pickerMonth, { selectedWinner: '' }); setPickerMonth(null); }}>
                  <IoCloseCircleOutline size={16} /> <span style={{ fontWeight: 500 }}>Clear selection</span>
                </button>
              )}
              {pickerData.available.length === 0 ? (
                <p className="muted" style={{ textAlign: 'center', padding: 20 }}>All members have already been assigned as winners.</p>
              ) : (
                pickerData.available.map((m) => {
                  const selected = pickerData.currentPick === String(m._id);
                  return (
                    <button key={m._id} className="row gap-8" style={{ width: '100%', padding: 12, background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }}
                      onClick={() => { updateRow(pickerMonth, { selectedWinner: String(m._id) }); setPickerMonth(null); }}>
                      <span style={{ fontWeight: 500 }}>{m.name || '(no name)'}</span>
                      <span className="muted" style={{ fontSize: 12 }}>+91 {m.phone}</span>
                      {selected && <IoCheckmark size={16} color="var(--primary)" style={{ marginLeft: 'auto' }} />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Save-warning */}
      {warn && (
        <div className="modal-backdrop" onMouseDown={() => !saving && setWarn(null)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 400, textAlign: 'center' }}>
            <div className="center" style={{ width: 56, height: 56, borderRadius: 28, background: 'var(--warning-light)', margin: '0 auto 14px' }}>
              <IoAlertCircleOutline size={30} color="var(--warning)" />
            </div>
            <h3 style={{ fontSize: 17, marginBottom: 8 }}>Winner EMI overrides</h3>
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>
              Group default is <b style={{ color: 'var(--text)' }}>{inr(warn.groupWinnerEmi)}</b>.
              {' '}{warn.divergent.length} month{warn.divergent.length === 1 ? '' : 's'} will use a different amount:
            </p>
            <div className="card mb-16" style={{ background: 'var(--background-secondary)', padding: '4px 12px', textAlign: 'left' }}>
              {warn.divergent.slice(0, 4).map((d, i) => (
                <div key={d.month} className="row between" style={{ padding: '10px 0', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{d.monthName}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>{inr(d.winnerEMI)}</span>
                </div>
              ))}
              {warn.divergent.length > 4 && <div className="muted" style={{ textAlign: 'center', fontSize: 12, padding: '6px 0' }}>… and {warn.divergent.length - 4} more</div>}
            </div>
            <button className="btn btn-block" onClick={() => persistConfig(warn.payload)} disabled={saving}>{saving ? 'Saving…' : 'Save with overrides'}</button>
            <button className="btn btn-ghost btn-block mt-8" onClick={() => setWarn(null)} disabled={saving}>Review changes</button>
          </div>
        </div>
      )}

      {/* Info */}
      {showInfo && (
        <div className="modal-backdrop" onMouseDown={() => setShowInfo(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="row gap-10 mb-16">
              <span className="center" style={{ width: 36, height: 36, borderRadius: 18, background: 'var(--primary-light)', border: '1px solid var(--primary)' }}>
                <IoInformationCircleOutline size={22} color="var(--primary)" />
              </span>
              <h3 style={{ fontSize: 16, flex: 1 }}>How POT Config works</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowInfo(false)} style={{ border: 'none' }}><IoClose size={20} /></button>
            </div>
            {[
              <>Select a <b>POT winner</b> for each month.</>,
              <><b>Winner EMI</b> defaults to the group value. Editing a row prompts for confirmation on save.</>,
              <><b>Reducing EMI</b> can be set per month for non-winners.</>,
              <><b>Past months are locked</b> once their draw has been executed.</>,
              <>The <b>current month</b> is highlighted so you can find it at a glance.</>,
            ].map((t, i) => (
              <div key={i} className="row gap-8" style={{ alignItems: 'flex-start', marginBottom: 10 }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--primary)', marginTop: 7, flexShrink: 0 }} />
                <span style={{ fontSize: 13, lineHeight: 1.5 }}>{t}</span>
              </div>
            ))}
            <button className="btn btn-block mt-8" onClick={() => setShowInfo(false)}>Got it</button>
          </div>
        </div>
      )}
    </div>
  );
}
