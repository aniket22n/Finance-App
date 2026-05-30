import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IoAdd, IoSearch, IoCloseCircle, IoListOutline, IoReorderFourOutline,
  IoSettingsOutline, IoCreateOutline, IoPeopleOutline, IoClose,
  IoShieldCheckmarkOutline, IoAlertCircle, IoCheckmark,
} from 'react-icons/io5';
import { getGroups, createGroup, updateGroup, sendOtp, verifyOtp, errMsg } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';
import Spinner from '../../components/Spinner';

const EMPTY_FORM = { name: '', potAmount: '', emiAmount: '', reducedEmi: '', maxMembers: '', dueDay: '' };
const FIELDS = [
  { key: 'name', label: 'Group Name', placeholder: 'e.g. Alpha Chit Fund' },
  { key: 'potAmount', label: 'POT amount', placeholder: '500000', prefix: '₹', numeric: true },
  { key: 'emiAmount', label: 'EMI (POT winners)', placeholder: '5000', prefix: '₹', numeric: true },
  { key: 'reducedEmi', label: 'Reducing EMI (Non winners)', placeholder: '2500', prefix: '₹', numeric: true },
  { key: 'maxMembers', label: 'Number of members', placeholder: '20', numeric: true },
  { key: 'dueDay', label: 'Due date (Day of month)', placeholder: '5', numeric: true },
];

export default function AdminGroupsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('active');
  const [compact, setCompact] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // OTP-confirm flow (edits)
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [pendingEdit, setPendingEdit] = useState(null);

  const load = async () => {
    try {
      const { data } = await getGroups();
      setGroups(data.groups || data || []);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const openCreate = () => { setEditTarget(null); setForm(EMPTY_FORM); setAgreed(false); setShowModal(true); };
  const openEdit = (g) => {
    setEditTarget(g);
    setForm({
      name: g.name || '', potAmount: String(g.potAmount || ''), emiAmount: String(g.emiAmount || ''),
      reducedEmi: String(g.reducedEmi ?? g.reducedEmiAmount ?? ''), maxMembers: String(g.maxMembers || ''), dueDay: String(g.dueDay || ''),
    });
    setAgreed(true); setShowModal(true);
  };

  const handleSubmit = async () => {
    const { name, emiAmount, reducedEmi, maxMembers } = form;
    if (!name.trim() || !emiAmount || !maxMembers) return toast.show('Fill in name, EMI amount, and number of members', 'info');
    if (!agreed && !editTarget) return toast.show('Please accept the terms & conditions', 'info');
    const emi = parseFloat(emiAmount), members = parseInt(maxMembers, 10), potEntered = parseFloat(form.potAmount);
    const payload = {
      name: name.trim(), emiAmount: emi,
      potAmount: Number.isFinite(potEntered) && potEntered > 0 ? potEntered : emi * members,
      reducedEmi: parseFloat(reducedEmi) || Math.round(emi * 0.5),
      maxMembers: members, totalMonths: members, dueDay: parseInt(form.dueDay, 10) || 5,
    };
    setSubmitting(true);
    try {
      if (editTarget) {
        await sendOtp(user?.phone);
        setPendingEdit({ groupId: editTarget._id, payload });
        setOtpCode(''); setOtpError(''); setOtpOpen(true);
      } else {
        const res = await createGroup(payload);
        const newId = res?.data?.group?._id || res?.data?._id;
        toast.success('Group created successfully');
        setShowModal(false);
        if (newId) navigate(`/admin/groups/${newId}/add-members`);
        else load();
      }
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmEdit = async () => {
    if (otpCode.length < 4) { setOtpError('Enter the OTP sent to your phone'); return; }
    if (!pendingEdit) return;
    setVerifying(true); setOtpError('');
    try {
      await verifyOtp(user?.phone, otpCode);
      await updateGroup(pendingEdit.groupId, pendingEdit.payload);
      setOtpOpen(false); setPendingEdit(null); setShowModal(false);
      toast.success('Group updated successfully');
      load();
    } catch (err) {
      const msg = (errMsg(err) || '').toLowerCase();
      if (msg.includes('otp') || msg.includes('invalid') || err?.response?.status === 400) setOtpError('Invalid OTP. Please try again.');
      else { toast.error(errMsg(err)); setOtpOpen(false); setPendingEdit(null); }
    } finally {
      setVerifying(false);
    }
  };

  const filtered = useMemo(() => {
    const base = search ? groups.filter((g) => g.name?.toLowerCase().includes(search.toLowerCase())) : [...groups];
    return base.sort((a, b) => {
      if (sortBy === 'active') {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        return 0;
      }
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }, [groups, search, sortBy]);

  return (
    <div>
      <header className="app-header">
        <h1>Groups</h1>
        <button className="center" style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--primary)', border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-primary)' }} onClick={openCreate}>
          <IoAdd size={22} color="#fff" />
        </button>
      </header>

      <div className="screen">
        {/* Search */}
        <div className="input row gap-8 mb-12" style={{ alignItems: 'center', background: 'var(--background-secondary)' }}>
          <IoSearch size={16} color="var(--text-secondary)" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search groups by name..."
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text)' }} />
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none' }}><IoCloseCircle size={16} color="var(--text-secondary)" /></button>}
        </div>

        {/* Count + sort + compact */}
        <div className="row between mb-12">
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.6, color: 'var(--text-tertiary)' }}>ALL GROUPS ({filtered.length})</span>
          <div className="row gap-6">
            {['active', 'recent'].map((s) => (
              <button key={s} onClick={() => setSortBy(s)}
                style={{
                  padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
                  border: `1px solid ${sortBy === s ? 'var(--primary)' : 'var(--border)'}`,
                  background: sortBy === s ? 'var(--primary)' : 'var(--background-secondary)',
                  color: sortBy === s ? '#fff' : 'var(--text-secondary)',
                }}>{s === 'active' ? 'Active' : 'Recent'}</button>
            ))}
            <button className="iconbtn-sm" data-on={compact ? 'true' : 'false'} onClick={() => setCompact((v) => !v)}>
              {compact ? <IoListOutline size={16} /> : <IoReorderFourOutline size={16} />}
            </button>
          </div>
        </div>

        {loading ? (
          <Spinner full />
        ) : filtered.length === 0 ? (
          <div className="empty"><IoPeopleOutline size={48} /><div>{search ? 'No groups found' : 'No groups yet'}</div></div>
        ) : (
          <div className="col gap-10">
            {filtered.map((g) => (
              <div key={g._id} className="card row gap-10" style={{ alignItems: 'center', padding: compact ? '10px 14px' : 14 }}>
                <button onClick={() => navigate(`/admin/groups/${g._id}`)} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{g.name}</div>
                  {compact ? (
                    <div className="muted" style={{ fontSize: 12 }}>{g.members?.length || 0} members · ₹{g.emiAmount?.toLocaleString('en-IN')}/mo</div>
                  ) : (
                    <>
                      <div className="muted" style={{ fontSize: 12, marginBottom: 2 }}>
                        {g.members?.length || 0}/{g.maxMembers || '?'} members{(g.currentMonth || 0) > 0 ? `  ·  Month ${g.currentMonth}/${g.totalMonths}` : ''}
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>₹{g.emiAmount?.toLocaleString('en-IN')}/month  ·  Due day {g.dueDay || 5}</div>
                    </>
                  )}
                </button>
                <div className="row gap-8" style={{ flexShrink: 0 }}>
                  <button className="grp-action" onClick={() => navigate(`/admin/groups/${g._id}/pot`)}>
                    <IoSettingsOutline size={18} color="var(--text-secondary)" /><span>POT Plan</span>
                  </button>
                  <button className="grp-action" onClick={() => openEdit(g)}>
                    <IoCreateOutline size={18} color="var(--text-secondary)" /><span>Edit</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit sheet */}
      {showModal && (
        <div className="sheet-backdrop" onMouseDown={() => setShowModal(false)}>
          <div className="sheet" onMouseDown={(e) => e.stopPropagation()} style={{ padding: '0 0 28px' }}>
            <div className="sheet-handle" />
            <div className="row between" style={{ padding: '0 20px 16px' }}>
              <h3 style={{ fontSize: 20 }}>{editTarget ? 'Edit Group' : 'Create Group'}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)} style={{ border: 'none' }}><IoClose size={22} /></button>
            </div>
            <div style={{ padding: '0 20px', maxHeight: '60vh', overflowY: 'auto' }}>
              {FIELDS.map(({ key, label, placeholder, prefix, numeric }) => (
                <div className="field" key={key}>
                  <label>{label}</label>
                  <div className="input row" style={{ alignItems: 'center', background: 'var(--background-secondary)' }}>
                    {prefix && <span style={{ color: 'var(--primary)', fontWeight: 600, marginRight: 2 }}>{prefix}</span>}
                    <input value={form[key]} onChange={(e) => setField(key, numeric ? e.target.value.replace(/[^0-9.]/g, '') : e.target.value)}
                      placeholder={placeholder} inputMode={numeric ? 'numeric' : 'text'}
                      style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text)' }} />
                  </div>
                </div>
              ))}

              {!editTarget && (
                <button className="row gap-10" onClick={() => setAgreed((v) => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', margin: '4px 0 8px', padding: 0 }}>
                  <span className="checkbox" data-on={agreed ? 'true' : 'false'}>{agreed && <IoCheckmark size={12} color="#fff" />}</span>
                  <span className="muted" style={{ fontSize: 13 }}>I agree to <span style={{ color: 'var(--primary)' }}>terms &amp; conditions</span></span>
                </button>
              )}
              {editTarget && (
                <div className="row gap-6" style={{ background: 'var(--primary-light)', border: '1px solid var(--primary)', borderRadius: 10, padding: '10px 12px', margin: '8px 0 4px' }}>
                  <IoShieldCheckmarkOutline size={14} color="var(--primary)" />
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--primary-dark)' }}>Edits to an active group require OTP confirmation.</span>
                </div>
              )}

              <button className="btn btn-block mt-16" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Working…' : editTarget ? 'Continue with OTP' : 'Create Group'}
              </button>
              <button className="btn btn-ghost btn-block mt-8" onClick={() => setShowModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* OTP confirm (edit) */}
      {otpOpen && (
        <div className="modal-backdrop" onMouseDown={() => !verifying && setOtpOpen(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 380, textAlign: 'center' }}>
            <div className="center" style={{ width: 64, height: 64, borderRadius: 32, background: 'var(--primary-light)', margin: '0 auto 16px' }}>
              <IoShieldCheckmarkOutline size={32} color="var(--primary)" />
            </div>
            <h3 style={{ fontSize: 18, marginBottom: 8 }}>Confirm Edit</h3>
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 20 }}>Enter the OTP sent to +91 {user?.phone} to save your changes.</p>
            <input className="input" style={{ textAlign: 'center', letterSpacing: 8, fontWeight: 700, fontSize: 20, ...(otpError ? { borderColor: 'var(--error)' } : {}) }}
              inputMode="numeric" maxLength={6} value={otpCode} autoFocus placeholder="Enter OTP"
              onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, '')); setOtpError(''); }} />
            {otpError && <div className="row gap-4 mt-8" style={{ justifyContent: 'center', color: 'var(--error)', fontSize: 12 }}><IoAlertCircle size={13} /> {otpError}</div>}
            <button className="btn btn-block mt-12" onClick={confirmEdit} disabled={verifying}>{verifying ? 'Working…' : 'Confirm Changes'}</button>
            <button className="btn btn-ghost btn-block mt-8" onClick={() => setOtpOpen(false)} disabled={verifying}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
