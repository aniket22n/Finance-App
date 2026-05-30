import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoCard, IoRefresh, IoReceiptOutline, IoArrowForward, IoPeopleOutline } from 'react-icons/io5';
import { useAuth } from '../context/AuthContext';
import { getGroups, getMyPendingPayments, errMsg } from '../services/api';
import { useToast } from '../components/Toast';
import GroupCard from '../components/GroupCard';
import Spinner from '../components/Spinner';
import NotificationsBell from '../components/NotificationsBell';

function compactInr(n) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
}

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [pending, setPending] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [g, p] = await Promise.all([getGroups(), getMyPendingPayments()]);
        setGroups(g.data.groups || g.data || []);
        setPending(p.data.data?.payments || p.data.payments || p.data || []);
      } catch (err) {
        toast.error(errMsg(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  if (loading) return <Spinner full />;

  const activeGroups = groups.filter((g) => g.status === 'active');
  const totalPot = activeGroups.reduce((s, g) => s + (g.potAmount || 0), 0);

  return (
    <div>
      <header className="app-header">
        <div>
          <div className="greeting">Hi,</div>
          <div className="hello-name">{user?.name || 'Member'} 👋</div>
        </div>
        <NotificationsBell />
      </header>

      {/* Gradient summary banner */}
      <div className="summary-banner gradient-banner">
        <div className="summary-stat">
          <div className="summary-value">{groups.length}</div>
          <div className="summary-label">My Groups</div>
        </div>
        <div className="summary-divider" />
        <div className="summary-stat">
          <div className="summary-value">{activeGroups.length}</div>
          <div className="summary-label">Active</div>
        </div>
        <div className="summary-divider" />
        <div className="summary-stat">
          <div className="summary-value">{compactInr(totalPot)}</div>
          <div className="summary-label">Total Pot</div>
        </div>
      </div>

      {/* Action required */}
      {pending.length > 0 && (
        <>
          <div className="sec-head">
            <span className="section-title">Action Required</span>
            <span className="count-pill">{pending.length}</span>
          </div>
          <div className="screen">
            {pending.map((p) => {
              const isRejected = p.status === 'failed' || p.status === 'rejected';
              return (
                <div
                  key={p._id}
                  className="card mb-12"
                  style={isRejected ? { borderLeft: '3px solid var(--error)', cursor: 'pointer' } : { cursor: 'pointer' }}
                  onClick={() => navigate('/payments')}
                >
                  <div className="row gap-12" style={{ alignItems: 'flex-start' }}>
                    <span className="pcard-icon" style={{ background: 'var(--background-secondary)', color: 'var(--text-secondary)' }}>
                      <IoReceiptOutline size={20} />
                    </span>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="row between gap-8 mb-4">
                        <span className="pcard-group" style={{ flex: 1 }}>{p.group?.name || `Month ${p.month}`}</span>
                        <span className={`badge ${isRejected ? 'badge-red' : 'badge-gray'}`}>
                          {isRejected ? 'Rejected' : 'Pending'}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>
                        ₹{p.amount?.toLocaleString('en-IN')} · {(p.paymentMethod || 'UPI').toUpperCase()} · {timeAgo(p.paidAt || p.createdAt)}
                      </div>
                      <div className="faint" style={{ fontSize: 12 }}>Month {p.month}</div>
                      <button
                        className={`btn btn-block btn-sm mt-8 ${isRejected ? 'btn-danger' : ''}`}
                        style={isRejected ? { color: '#fff', background: 'var(--error)', border: 'none' } : undefined}
                        onClick={(e) => { e.stopPropagation(); navigate('/payments'); }}
                      >
                        {isRejected ? <IoRefresh size={14} /> : <IoCard size={14} />}
                        {isRejected ? 'Resubmit Payment' : 'Make Payment'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Active groups */}
      {activeGroups.length > 0 && (
        <>
          <div className="sec-head">
            <span className="section-title">Active Groups</span>
            <span className="sec-count">{activeGroups.length} groups</span>
          </div>
          <div className="screen col gap-12">
            {activeGroups.slice(0, 2).map((g) => (
              <GroupCard key={g._id} group={g} to={`/groups/${g._id}`} />
            ))}
          </div>
          {activeGroups.length > 2 && (
            <div className="screen mt-12">
              <button className="btn btn-outline btn-block" onClick={() => navigate('/groups')}>
                View All Groups <IoArrowForward size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {groups.length === 0 && (
        <div className="screen mt-16">
          <div className="empty">
            <div className="empty-icon"><IoPeopleOutline size={48} /></div>
            <div className="empty-title">No Groups Yet</div>
            <div className="muted">You'll be added to a group by your admin.</div>
          </div>
        </div>
      )}
    </div>
  );
}
