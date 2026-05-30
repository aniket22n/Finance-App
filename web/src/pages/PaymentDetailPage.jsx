import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  IoArrowBack, IoTimeOutline, IoHourglassOutline, IoCheckmarkCircle,
  IoCloseCircle, IoAlertCircleOutline, IoInformationCircleOutline,
  IoCard, IoRefresh,
} from 'react-icons/io5';
import { useAuth } from '../context/AuthContext';
import { getUserPayments, getMyPendingPayments, errMsg } from '../services/api';
import { useToast } from '../components/Toast';
import Spinner from '../components/Spinner';
import Empty from '../components/Empty';
import { inr } from '../utils/format';

// Status → colours (theme status tokens) + hero icon, mirroring mobile
// PaymentDetailScreen's STATUS_CONFIG.
const STATUS = {
  paid:     { bg: 'var(--st-paid-bg)',     fg: 'var(--st-paid-fg)',     Icon: IoHourglassOutline, label: 'Awaiting' },
  pending:  { bg: 'var(--background-tertiary)', fg: 'var(--text-secondary)', Icon: IoTimeOutline, label: 'Pending'  },
  verified: { bg: 'var(--st-verified-bg)', fg: 'var(--st-verified-fg)', Icon: IoCheckmarkCircle,  label: 'Verified' },
  failed:   { bg: 'var(--st-rejected-bg)', fg: 'var(--st-rejected-fg)', Icon: IoCloseCircle,      label: 'Rejected' },
  rejected: { bg: 'var(--st-rejected-bg)', fg: 'var(--st-rejected-fg)', Icon: IoCloseCircle,      label: 'Rejected' },
};

function fmtDateTime(d) {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date)) return null;
  return (
    date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ', ' +
    date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  );
}

function InfoRow({ label, value, first }) {
  return (
    <div
      className="row between"
      style={{
        padding: '9px 0',
        gap: 12,
        borderTop: first ? 'none' : '1px solid var(--border)',
      }}
    >
      <span className="muted" style={{ fontSize: 13 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, textAlign: 'right' }}>{value || '—'}</span>
    </div>
  );
}

export default function PaymentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const toast = useToast();

  // Prefer the payment passed via router state (instant); fall back to a
  // lookup by id when the page is opened/refreshed directly.
  const [payment, setPayment] = useState(location.state?.payment || null);
  const [loading, setLoading] = useState(!location.state?.payment);

  useEffect(() => {
    if (payment) return;
    (async () => {
      try {
        const results = await Promise.allSettled([
          user?._id ? getUserPayments(user._id) : Promise.reject(),
          getMyPendingPayments(),
        ]);
        let list = [];
        for (const r of results) {
          if (r.status === 'fulfilled') {
            const d = r.value.data;
            list = list.concat(d.data?.payments || d.payments || d || []);
          }
        }
        setPayment(list.find((p) => p._id === id) || null);
      } catch (err) {
        toast.error(errMsg(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, payment, user, toast]);

  if (loading) return <Spinner full />;
  if (!payment) return <Empty title="Payment not found" />;

  const cfg = STATUS[payment.status] || STATUS.pending;
  const { Icon } = cfg;
  const isPaid = payment.status === 'paid';
  const isVerified = payment.status === 'verified';
  const isRejected = payment.status === 'failed' || payment.status === 'rejected';
  const isPending = payment.status === 'pending';
  const canPay = isPending || isRejected;
  const groupId = payment.group?._id || payment.group;

  const heroTimestamp = isPaid
    ? `Submitted on ${fmtDateTime(payment.paidAt || payment.createdAt)}`
    : isVerified
    ? `Verified on ${fmtDateTime(payment.verifiedAt || payment.updatedAt)}`
    : isRejected
    ? `Rejected on ${fmtDateTime(payment.verifiedAt || payment.updatedAt)}`
    : 'Payment not submitted yet';

  const goPay = () =>
    navigate(`/pay/${groupId}`, { state: { from: location.pathname } });

  return (
    <div>
      <header className="app-header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
          <IoArrowBack size={16} /> Back
        </button>
        <span className="badge" style={{ background: cfg.bg, color: cfg.fg }}>{cfg.label}</span>
      </header>

      <div className="screen" style={{ maxWidth: 600, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, marginBottom: 16 }}>Payment Details</h1>

        {/* Hero */}
        <div
          className="card row between mb-16"
          style={{ background: cfg.bg, border: 'none', alignItems: 'center', gap: 12 }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: cfg.fg, marginBottom: 2 }}>
              Month {payment.month} Payment
              {payment.group?.name ? <span style={{ opacity: 0.7, fontWeight: 500 }}> ({payment.group.name})</span> : ''}
            </div>
            <div className="amount" style={{ fontSize: 28, fontWeight: 800, color: cfg.fg }}>
              {inr(payment.amount)}
            </div>
            <div style={{ fontSize: 11, color: cfg.fg, opacity: 0.85, marginTop: 3 }}>{heroTimestamp}</div>
          </div>
          <Icon size={40} color={cfg.fg} style={{ flexShrink: 0 }} />
        </div>

        {/* Payment Information */}
        <div className="section-title">Payment Information</div>
        <div className="card mb-16" style={{ padding: '4px 16px' }}>
          <InfoRow label="Group" value={payment.group?.name} first />
          <InfoRow label="Method" value={(payment.paymentMethod || 'UPI').toUpperCase()} />
          <InfoRow label="Month" value={`Month ${payment.month}`} />
          {(payment.paidAt || payment.createdAt) && (
            <InfoRow label="Submitted" value={fmtDateTime(payment.paidAt || payment.createdAt)} />
          )}
          {payment.upiTransactionId && <InfoRow label="Transaction ID" value={payment.upiTransactionId} />}
          {payment.upiRef && <InfoRow label="UPI Ref" value={payment.upiRef} />}
          {isVerified && payment.verifiedBy?.name && (
            <InfoRow label="Verified By" value={payment.verifiedBy.name} />
          )}
        </div>

        {/* Receipt */}
        {payment.receipt && (
          <>
            <div className="section-title">Receipt</div>
            <div className="card mb-16">
              <img src={payment.receipt} alt="receipt" style={{ maxWidth: '100%', borderRadius: 10, display: 'block' }} />
            </div>
          </>
        )}

        {/* Rejection reason */}
        {isRejected && payment.notes && (
          <div
            className="card mb-16 row gap-10"
            style={{ background: 'var(--st-rejected-bg)', borderColor: 'var(--st-rejected-bd)', alignItems: 'flex-start' }}
          >
            <IoAlertCircleOutline size={18} color="var(--st-rejected-fg)" style={{ marginTop: 1, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--st-rejected-fg)', marginBottom: 3 }}>Rejection Reason</div>
              <div style={{ fontSize: 12, color: 'var(--st-rejected-fg)', lineHeight: 1.5 }}>{payment.notes}</div>
            </div>
          </div>
        )}

        {/* Pending info */}
        {isPending && (
          <div className="card mb-16 row gap-10" style={{ alignItems: 'flex-start' }}>
            <IoInformationCircleOutline size={18} color="var(--text-secondary)" style={{ marginTop: 1, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>Payment not submitted yet</div>
              <div className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
                Tap "Make Payment" below to pay your EMI for this month.
              </div>
            </div>
          </div>
        )}

        {/* Awaiting info */}
        {isPaid && (
          <div
            className="card mb-16 row gap-10"
            style={{ background: 'var(--st-paid-bg)', borderColor: 'var(--st-paid-bd)', alignItems: 'flex-start' }}
          >
            <IoHourglassOutline size={18} color="var(--st-paid-fg)" style={{ marginTop: 1, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--st-paid-fg)', marginBottom: 3 }}>Awaiting Verification</div>
              <div style={{ fontSize: 12, color: 'var(--st-paid-fg)', lineHeight: 1.5 }}>
                Your payment has been submitted. Admin will verify it shortly.
              </div>
            </div>
          </div>
        )}

        {/* Activity history */}
        {(isVerified || isRejected) && payment.verifiedAt && (
          <>
            <div className="section-title">Activity History</div>
            <div className="card mb-16">
              <div className="row gap-12" style={{ alignItems: 'flex-start' }}>
                <span style={{ width: 10, height: 10, borderRadius: 5, background: cfg.fg, marginTop: 4, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {isVerified ? 'Payment Verified' : 'Payment Rejected'}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {fmtDateTime(payment.verifiedAt)}
                    {payment.verifiedBy?.name ? ` by ${payment.verifiedBy.name}` : ''}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Action */}
        {canPay && groupId && (
          <button
            className={`btn btn-block ${isRejected ? 'btn-danger' : ''}`}
            style={isRejected ? { color: '#fff', background: 'var(--error)', border: 'none' } : undefined}
            onClick={goPay}
          >
            {isRejected ? <IoRefresh size={16} /> : <IoCard size={16} />}
            {isRejected ? 'Resubmit Payment' : 'Make Payment'}
          </button>
        )}
      </div>
    </div>
  );
}
