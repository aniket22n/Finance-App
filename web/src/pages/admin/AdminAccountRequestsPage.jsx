import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IoArrowBack, IoPeopleOutline, IoTimeOutline, IoCheckmarkCircleOutline,
  IoPerson, IoCheckmark, IoClose, IoCheckmarkCircle,
} from 'react-icons/io5';
import { getAccountRequests, approveAccountRequest, rejectAccountRequest, errMsg } from '../../services/api';
import { useToast } from '../../components/Toast';
import Spinner from '../../components/Spinner';

// 'rejected' is intentionally absent — rejected requests are deleted so the user can re-apply.
const FILTERS = [
  { id: 'all', label: 'All', Icon: IoPeopleOutline, iconColor: 'var(--text-secondary)' },
  { id: 'pending', label: 'Pending', Icon: IoTimeOutline, iconColor: '#F59E0B' },
  { id: 'approved', label: 'Approved', Icon: IoCheckmarkCircleOutline, iconColor: '#10B981' },
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

export default function AdminAccountRequestsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [filter, setFilter] = useState('all');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(null);

  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getAccountRequests(filter === 'all' ? undefined : filter);
      setRequests(data.requests || data || []);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);
  useEffect(() => { load(); }, [load]);

  const handleApprove = async (r) => {
    if (!window.confirm(`Approve account for ${r.name} (+91 ${r.phone})?`)) return;
    setActionBusy(r._id);
    try {
      await approveAccountRequest(r._id);
      setRequests((prev) => prev.map((x) => (x._id === r._id ? { ...x, status: 'approved', reviewedAt: new Date().toISOString() } : x)));
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setActionBusy(null);
    }
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    const id = rejectTarget._id;
    setActionBusy(id);
    setRejectTarget(null);
    try {
      await rejectAccountRequest(id, rejectReason || undefined);
      setRequests((prev) => prev.filter((r) => r._id !== id)); // backend deletes the record
      toast.success('Request rejected and removed');
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setActionBusy(null);
      setRejectReason('');
    }
  };

  const filterLabel = filter === 'all' ? 'All' : filter === 'pending' ? 'Pending' : 'Approved';

  return (
    <div>
      <header className="app-header" style={{ gap: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ border: 'none', padding: 0 }}><IoArrowBack size={22} /></button>
        <h1 style={{ flex: 1, fontSize: 22 }}>Account Requests</h1>
      </header>

      {/* Filter pills */}
      <div className="row gap-8 wrap" style={{ padding: '8px 16px' }}>
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className="row gap-6"
              style={{
                height: 34, padding: '0 14px', borderRadius: 20, cursor: 'pointer',
                border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                background: active ? 'var(--primary)' : 'var(--background)',
                color: active ? '#fff' : 'var(--text-secondary)', fontSize: 13, fontWeight: active ? 600 : 500,
              }}>
              <f.Icon size={15} color={active ? '#fff' : f.iconColor} /> {f.label}
            </button>
          );
        })}
      </div>

      <div className="screen">
        <div style={{ fontSize: 15, fontWeight: 700, padding: '2px 0 10px' }}>{filterLabel} Requests ({requests.length})</div>

        {loading ? (
          <Spinner full />
        ) : requests.length === 0 ? (
          <div className="empty" style={{ borderStyle: 'dashed' }}>No {filter === 'all' ? '' : filter} requests</div>
        ) : (
          <div className="col gap-8">
            {requests.map((r) => {
              const isBusy = actionBusy === r._id;
              const isPending = r.status === 'pending';
              return (
                <div key={r._id} className="card" style={{ padding: 12, ...(isPending ? { background: 'var(--primary-light)', borderColor: 'var(--primary)', borderLeft: '4px solid var(--primary)' } : {}) }}>
                  <div className="row gap-12">
                    <span className="center" style={{ width: 44, height: 44, borderRadius: 22, background: 'var(--background-secondary)', border: '1px solid var(--border)', flexShrink: 0 }}>
                      <IoPerson size={18} color="var(--text-secondary)" />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 1 }}>+91 {r.phone}<span className="faint">  ·  </span>{timeAgo(r.createdAt)}</div>
                    </div>
                    {isPending ? (
                      <span className="center" style={{ width: 32, height: 32, borderRadius: 16, border: '1px solid #F59E0B', flexShrink: 0 }}><IoTimeOutline size={18} color="#F59E0B" /></span>
                    ) : (
                      <span className="center" style={{ width: 32, height: 32, borderRadius: 16, background: 'var(--success-light)', flexShrink: 0 }}><IoCheckmarkCircle size={18} color="#10B981" /></span>
                    )}
                  </div>

                  {isPending && (
                    <>
                      <div style={{ height: 1, background: 'var(--primary)', opacity: 0.25, margin: '12px 0' }} />
                      <div className="row gap-10">
                        <button className="btn grow" style={{ background: '#10B981', border: 'none', color: '#fff', height: 46 }} onClick={() => handleApprove(r)} disabled={!!actionBusy}>
                          {isBusy ? 'Working…' : <><IoCheckmark size={16} /> Approve</>}
                        </button>
                        <button className="btn grow" style={{ background: '#EF4444', border: 'none', color: '#fff', height: 46 }} onClick={() => { setRejectTarget(r); setRejectReason(''); }} disabled={!!actionBusy}>
                          <IoClose size={16} /> Reject
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reject reason sheet */}
      {rejectTarget && (
        <div className="sheet-backdrop" onMouseDown={() => setRejectTarget(null)}>
          <div className="sheet" onMouseDown={(e) => e.stopPropagation()} style={{ padding: '0 24px 36px' }}>
            <div className="sheet-handle" />
            <h3 style={{ fontSize: 18, marginBottom: 6 }}>Reject Request</h3>
            <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>Reject account for {rejectTarget.name}?</p>
            <textarea className="input" rows={3} value={rejectReason} maxLength={200}
              onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason (optional)" style={{ marginBottom: 16 }} />
            <div className="row gap-10">
              <button className="btn btn-ghost grow" onClick={() => setRejectTarget(null)}>Cancel</button>
              <button className="btn grow" style={{ background: '#EF4444', border: 'none', color: '#fff' }} onClick={confirmReject}>Confirm Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
