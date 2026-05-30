import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IoArrowBack, IoPeople, IoPeopleOutline, IoSearch, IoSwapVertical, IoTrashOutline,
  IoLockClosed, IoShieldCheckmark, IoPerson, IoAlertCircle, IoClose,
} from 'react-icons/io5';
import { getAdminUsers, deleteUser, sendOtp, verifyOtp, errMsg } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';
import Spinner from '../../components/Spinner';

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const toast = useToast();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [userSort, setUserSort] = useState('name');
  const [groupsPeek, setGroupsPeek] = useState(null);

  // OTP-gated delete
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [delOtpSent, setDelOtpSent] = useState(false);
  const [delOtpCode, setDelOtpCode] = useState('');
  const [delOtpError, setDelOtpError] = useState('');
  const [sendingDelOtp, setSendingDelOtp] = useState(false);
  const [verifyingDelete, setVerifyingDelete] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await getAdminUsers({ limit: 100 });
        setUsers(res.data.users || []);
      } catch {
        toast.error('Failed to load users');
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const handleDeleteUser = (u) => {
    if (u.role === 'admin') return toast.error('Admin accounts cannot be deleted');
    if (String(u._id) === String(currentUser?._id)) return toast.error('You cannot delete your own account');
    setDelOtpCode(''); setDelOtpError(''); setDelOtpSent(false); setDeleteTarget({ user: u });
  };

  const sendDeleteOtp = async () => {
    setDelOtpError(''); setDelOtpSent(true); setSendingDelOtp(true);
    try {
      await sendOtp(currentUser?.phone);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSendingDelOtp(false);
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (delOtpCode.length < 4) { setDelOtpError('Enter the OTP sent to your phone'); return; }
    if (!deleteTarget?.user) return;
    setVerifyingDelete(true); setDelOtpError('');
    try {
      await verifyOtp(currentUser?.phone, delOtpCode);
      await deleteUser(deleteTarget.user._id);
      setUsers((prev) => prev.filter((x) => x._id !== deleteTarget.user._id));
      toast.success('User removed');
      setDeleteTarget(null);
    } catch (err) {
      const msg = (errMsg(err) || '').toLowerCase();
      if (msg.includes('otp') || msg.includes('invalid') || [400, 401].includes(err?.response?.status)) {
        setDelOtpError('Invalid OTP. Please try again.');
      } else {
        toast.error(errMsg(err));
        setDeleteTarget(null);
      }
    } finally {
      setVerifyingDelete(false);
    }
  };

  const visibleUsers = useMemo(() => {
    const list = users.filter((u) =>
      !userSearch || u.name?.toLowerCase().includes(userSearch.toLowerCase()) || u.phone?.includes(userSearch));
    return [...list].sort((a, b) => userSort === 'name'
      ? (a.name || a.phone || '').localeCompare(b.name || b.phone || '')
      : new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [users, userSearch, userSort]);

  return (
    <div>
      <header className="app-header" style={{ gap: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ border: 'none', padding: 0 }}><IoArrowBack size={22} /></button>
        <span className="center" style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--primary-light)', flexShrink: 0 }}><IoPeople size={20} color="var(--primary)" /></span>
        <h1 style={{ flex: 1, fontSize: 22 }}>User Management</h1>
      </header>

      <div className="screen">
        {/* Search */}
        <div className="input row gap-8 mb-12" style={{ alignItems: 'center' }}>
          <IoSearch size={16} color="var(--text-secondary)" />
          <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search by name or phone number…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text)' }} />
        </div>

        {/* Count + sort */}
        <div className="row between mb-12">
          <span style={{ fontWeight: 600 }}>{visibleUsers.length} {visibleUsers.length === 1 ? 'Member' : 'Members'}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setUserSort((s) => (s === 'name' ? 'recent' : 'name'))} style={{ border: 'none' }}>
            Sorted by {userSort === 'name' ? 'Name' : 'Recent'} <IoSwapVertical size={15} />
          </button>
        </div>

        {loading ? (
          <Spinner full />
        ) : visibleUsers.length === 0 ? (
          <div className="empty"><IoPeopleOutline size={36} /><div>{userSearch ? 'No matching users' : 'No users yet'}</div></div>
        ) : (
          <div className="col gap-8">
            {visibleUsers.map((u) => {
              const grps = u.groups || [];
              const isAdmin = u.role === 'admin';
              return (
                <div key={u._id} className="card row gap-12" style={{ padding: 12, ...(isAdmin ? { borderColor: 'var(--primary)', background: 'var(--primary-light)' } : {}) }}>
                  <span className="center" style={{ position: 'relative', width: 44, height: 44, borderRadius: 22, flexShrink: 0, background: isAdmin ? 'var(--primary)' : 'var(--background-secondary)', color: isAdmin ? '#fff' : 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                    <IoPerson size={18} />
                    {isAdmin && (
                      <span className="center" style={{ position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: 8, background: 'var(--warning)', border: '1.5px solid var(--background)' }}>
                        <IoShieldCheckmark size={9} color="#fff" />
                      </span>
                    )}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{u.name || '(no name)'}</div>
                    <div className="muted" style={{ fontSize: 12 }}>+91 {u.phone}</div>
                    {isAdmin && (
                      <div className="row gap-6 mt-8">
                        <span className="badge badge-purple">ADMIN</span>
                        <span className="badge badge-green"><IoLockClosed size={9} /> Protected</span>
                      </div>
                    )}
                  </div>
                  <div className="row gap-8">
                    {grps.length > 0 && !isAdmin && (
                      <button className="btn btn-ghost btn-sm" onClick={() => setGroupsPeek({ user: u })} style={{ border: 'none', color: 'var(--primary)', fontWeight: 700 }}>
                        <IoPeople size={18} /> {grps.length}
                      </button>
                    )}
                    {isAdmin ? (
                      <span className="center" style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--primary-light)' }}><IoLockClosed size={14} color="var(--primary)" /></span>
                    ) : (
                      <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteUser(u)} style={{ border: 'none' }}><IoTrashOutline size={20} color="var(--error)" /></button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Groups peek */}
      {groupsPeek && (
        <div className="sheet-backdrop" onMouseDown={() => setGroupsPeek(null)}>
          <div className="sheet" onMouseDown={(e) => e.stopPropagation()} style={{ padding: '0 20px 28px' }}>
            <div className="sheet-handle" />
            <div className="row between mb-8">
              <h3 style={{ fontSize: 15 }}>{groupsPeek.user.name || groupsPeek.user.phone}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setGroupsPeek(null)} style={{ border: 'none' }}><IoClose size={18} /></button>
            </div>
            <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
              Member of {(groupsPeek.user.groups || []).length} group{(groupsPeek.user.groups || []).length === 1 ? '' : 's'}
            </p>
            <div className="col gap-4">
              {(groupsPeek.user.groups || []).map((g) => (
                <div key={g._id} className="card row gap-8" style={{ padding: '8px 12px' }}>
                  <IoShieldCheckmark size={10} color="var(--primary)" /> <span style={{ fontWeight: 500 }}>{g.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* OTP-gated delete */}
      {deleteTarget && (
        <div className="modal-backdrop" onMouseDown={() => !verifyingDelete && setDeleteTarget(null)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 420, textAlign: 'center' }}>
            <div className="center" style={{ width: 56, height: 56, borderRadius: 28, background: 'var(--error-light)', margin: '0 auto 12px' }}>
              <IoShieldCheckmark size={28} color="var(--error)" />
            </div>
            <h3 style={{ fontSize: 17, marginBottom: 8 }}>Delete Member</h3>
            <p className="muted" style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 12 }}>
              {(deleteTarget.user.groups || []).length > 0 ? (
                <>
                  <b style={{ color: 'var(--text)' }}>{deleteTarget.user.name || deleteTarget.user.phone}</b> is a member of{' '}
                  <b style={{ color: 'var(--text)' }}>{deleteTarget.user.groups.length} group{deleteTarget.user.groups.length === 1 ? '' : 's'}</b>.
                  Deleting will also remove them from those groups.
                </>
              ) : (
                <>Remove <b style={{ color: 'var(--text)' }}>{deleteTarget.user.name || deleteTarget.user.phone}</b> permanently?</>
              )}
            </p>

            {!delOtpSent ? (
              <>
                <p className="faint" style={{ fontSize: 11, marginBottom: 8 }}>An OTP will be sent to +91 {currentUser?.phone || '—'} to confirm.</p>
                <button className="btn btn-block" style={{ background: 'var(--error)', color: '#fff', border: 'none' }} onClick={sendDeleteOtp} disabled={sendingDelOtp}>
                  {sendingDelOtp ? 'Sending…' : 'Get OTP'}
                </button>
              </>
            ) : (
              <>
                <p className="faint" style={{ fontSize: 11, marginBottom: 8 }}>OTP sent to +91 {currentUser?.phone || '—'}</p>
                <input className="input" style={{ textAlign: 'center', letterSpacing: 6, fontWeight: 700, fontSize: 18, ...(delOtpError ? { borderColor: 'var(--error)' } : {}) }}
                  inputMode="numeric" maxLength={6} value={delOtpCode} autoFocus
                  onChange={(e) => { setDelOtpCode(e.target.value.replace(/\D/g, '')); setDelOtpError(''); }} placeholder="Enter OTP" />
                {delOtpError && <div className="row gap-4 mt-8" style={{ justifyContent: 'center', color: 'var(--error)', fontSize: 12 }}><IoAlertCircle size={13} /> {delOtpError}</div>}
                <button className="btn btn-block mt-8" style={{ background: 'var(--error)', color: '#fff', border: 'none' }} onClick={handleConfirmDeleteUser} disabled={verifyingDelete}>
                  {verifyingDelete ? 'Working…' : 'Confirm Delete'}
                </button>
              </>
            )}
            <button className="btn btn-ghost btn-block mt-8" onClick={() => setDeleteTarget(null)} disabled={verifyingDelete}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
