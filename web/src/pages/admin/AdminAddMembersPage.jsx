import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  IoChevronBack, IoSearch, IoCloseCircle, IoCheckmark, IoAdd,
  IoLockClosed, IoArrowForward, IoPeopleOutline, IoAlertCircleOutline,
} from 'react-icons/io5';
import { getGroup, getAdminUsers, addMember, removeMember, errMsg } from '../../services/api';
import { useToast } from '../../components/Toast';
import Spinner from '../../components/Spinner';
import Empty from '../../components/Empty';

export default function AdminAddMembersPage() {
  const { id: groupId } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const isManage = params.get('mode') === 'manage';
  const toast = useToast();

  const [group, setGroup] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pendingId, setPendingId] = useState(null);
  const [confirmShort, setConfirmShort] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [groupRes, usersRes] = await Promise.all([getGroup(groupId), getAdminUsers()]);
      setGroup(groupRes.data.group || groupRes.data);
      setUsers((usersRes.data.users || []).filter((u) => u.role !== 'admin'));
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setLoading(false);
    }
  }, [groupId, toast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const memberIds = useMemo(
    () => new Set((group?.members || []).map((m) => String(m._id || m))),
    [group]
  );

  const memberCount = memberIds.size;
  const requiredCount = group?.maxMembers || 0;
  const remaining = Math.max(0, requiredCount - memberCount);
  const overfilled = memberCount > requiredCount;
  const exactlyFull = memberCount === requiredCount && requiredCount > 0;
  const progressPct = requiredCount > 0 ? Math.min(100, (memberCount / requiredCount) * 100) : 0;
  const rosterLocked = group?.status === 'active' || (group?.currentMonth || 0) > 0;

  const sortedUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = !q ? users : users.filter((u) =>
      (u.name || '').toLowerCase().includes(q) || (u.phone || '').includes(q));
    const members = [], others = [];
    for (const u of filtered) (memberIds.has(String(u._id)) ? members : others).push(u);
    return [...members, ...others];
  }, [users, search, memberIds]);

  const toggleMember = async (user) => {
    if (rosterLocked) {
      return toast.show(group?.status === 'active'
        ? 'Member list is locked — group has been activated'
        : 'Member list is locked — the first draw has already been executed', 'info');
    }
    const isMember = memberIds.has(String(user._id));
    if (!isMember && memberCount >= requiredCount) {
      return toast.show(`Group already has ${requiredCount} members`, 'info');
    }
    setPendingId(user._id);
    try {
      const res = isMember ? await removeMember(groupId, user._id) : await addMember(groupId, user._id);
      if (res?.data?.group) setGroup(res.data.group);
      toast[isMember ? 'show' : 'success'](`${user.name || user.phone} ${isMember ? 'removed' : 'added'}`, isMember ? 'info' : undefined);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setPendingId(null);
    }
  };

  const goToPotConfig = () => navigate(`/admin/groups/${groupId}/pot`, { replace: true });

  const handleContinue = () => {
    if (isManage) return navigate(-1);
    if (memberCount === 0) return toast.show('Add at least one member to continue', 'info');
    if (memberCount < requiredCount) return setConfirmShort(true);
    goToPotConfig();
  };

  if (loading) return <Spinner full />;
  if (!group) return <Empty title="Group not found" />;

  return (
    <div>
      <header className="app-header">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ border: 'none', padding: 0, marginBottom: 4 }}>
            <IoChevronBack size={18} /> Groups
          </button>
          <h1 style={{ fontSize: 20 }}>Add Members</h1>
          <div className="muted" style={{ fontSize: 13 }}>{group.name}</div>
        </div>
      </header>

      <div className="screen" style={{ maxWidth: 600, margin: '0 auto', paddingBottom: 96 }}>
        {rosterLocked && (
          <div className="card mb-12 row gap-8" style={{ background: 'var(--warning-light)', borderColor: 'var(--warning)' }}>
            <IoLockClosed size={14} color="var(--warning)" />
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--warning)', lineHeight: 1.4 }}>
              Members are locked. Draws have started for this group — the roster can't be changed.
            </span>
          </div>
        )}

        {/* Progress card */}
        <div className="card mb-12" style={{ background: 'var(--background-secondary)' }}>
          <div className="row between" style={{ alignItems: 'baseline', marginBottom: 10 }}>
            <div style={{ fontSize: 22 }}>
              <b>{memberCount}</b>
              <span className="muted" style={{ fontSize: 18 }}> / {requiredCount}</span>
            </div>
            <span className="muted" style={{ fontSize: 12, fontWeight: 500 }}>
              {exactlyFull ? 'All members added' : overfilled ? `Over by ${memberCount - requiredCount}` : `${remaining} remaining`}
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--background-tertiary)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: exactlyFull ? 'var(--success)' : 'var(--primary)', transition: 'width .2s' }} />
          </div>
        </div>

        {/* Search */}
        <div className="input row gap-8 mb-12" style={{ alignItems: 'center' }}>
          <IoSearch size={16} color="var(--text-secondary)" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or phone..."
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text)' }} />
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none' }}><IoCloseCircle size={16} color="var(--text-secondary)" /></button>}
        </div>

        {/* User list */}
        {sortedUsers.length === 0 ? (
          <Empty icon={<IoPeopleOutline size={36} />} title={search ? 'No matching users' : 'No users available'} />
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {sortedUsers.map((u, i) => {
              const isMember = memberIds.has(String(u._id));
              const isPending = pendingId === u._id;
              return (
                <button key={u._id} onClick={() => toggleMember(u)} disabled={isPending || rosterLocked}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
                    padding: '10px 12px', background: 'none', border: 'none',
                    borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                    opacity: rosterLocked ? 0.55 : 1, cursor: rosterLocked ? 'default' : 'pointer',
                  }}>
                  <span className="center" style={{ width: 40, height: 40, borderRadius: 20, flexShrink: 0, border: '1px solid var(--border)', background: isMember ? 'var(--text-secondary)' : 'var(--background-secondary)', color: isMember ? '#fff' : 'var(--text-secondary)' }}>
                    {/* person glyph */}
                    <IoPeopleOutline size={18} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{u.name || 'No name'}</span>
                    <span className="muted" style={{ display: 'block', fontSize: 12 }}>+91 {u.phone}</span>
                  </span>
                  {isPending ? (
                    <span className="spinner" style={{ width: 18, height: 18 }} />
                  ) : isMember ? (
                    <span className="badge" style={{ background: 'var(--primary)', color: '#fff' }}><IoCheckmark size={14} /> Added</span>
                  ) : (
                    <span className="center" style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary-light)', border: '1px solid var(--primary)' }}>
                      <IoAdd size={16} color="var(--primary)" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ position: 'sticky', bottom: 0, padding: 16, background: 'var(--background)', borderTop: '1px solid var(--border)', maxWidth: 600, margin: '0 auto' }}>
        <button className="btn btn-block" onClick={handleContinue} disabled={!isManage && memberCount === 0}>
          {isManage ? 'Done' : 'Continue to POT Config'} {isManage ? <IoCheckmark size={18} /> : <IoArrowForward size={18} />}
        </button>
      </div>

      {/* Fewer-than-required confirm */}
      {confirmShort && (
        <div className="modal-backdrop" onMouseDown={() => setConfirmShort(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 400, textAlign: 'center' }}>
            <div className="center" style={{ width: 56, height: 56, borderRadius: 28, background: 'var(--warning-light)', margin: '0 auto 14px' }}>
              <IoAlertCircleOutline size={30} color="var(--warning)" />
            </div>
            <h3 style={{ fontSize: 17, marginBottom: 8 }}>Continue with fewer members?</h3>
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 18 }}>
              This group requires <b style={{ color: 'var(--text)' }}>{requiredCount} members</b> but only{' '}
              <b style={{ color: 'var(--text)' }}>{memberCount}</b> {memberCount === 1 ? 'is' : 'are'} added.
              You can add the remaining {remaining} member{remaining === 1 ? '' : 's'} later from group details.
            </p>
            <button className="btn btn-block" onClick={() => { setConfirmShort(false); goToPotConfig(); }}>Continue anyway</button>
            <button className="btn btn-ghost btn-block mt-8" onClick={() => setConfirmShort(false)}>Keep adding members</button>
          </div>
        </div>
      )}
    </div>
  );
}
