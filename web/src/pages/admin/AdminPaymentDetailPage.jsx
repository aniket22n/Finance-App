import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  IoArrowBack, IoTimeOutline, IoHourglassOutline, IoCheckmarkCircle,
  IoCloseCircle, IoAlertCircleOutline, IoInformationCircleOutline,
  IoCheckmarkCircleOutline, IoCloseCircleOutline, IoNotificationsOutline,
} from 'react-icons/io5';
import { useAuth } from '../../context/AuthContext';
import {
  getAdminPaymentsList, requestPaymentActionOtp, adminChangePaymentStatus,
  sendPaymentReminder, errMsg,
} from '../../services/api';
import { useToast } from '../../components/Toast';
import Spinner from '../../components/Spinner';
import Empty from '../../components/Empty';
import Avatar from '../../components/Avatar';
import { inr } from '../../utils/format';

// Mirrors mobile AdminPaymentDetailScreen STATUS_CONFIG (status tokens for theme).
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

function InfoRow({ label, value, first, children }) {
  return (
    <div className="row between" style={{ padding: '9px 0', gap: 12, borderTop: first ? 'none' : '1px solid var(--border)' }}>
      <span className="muted" style={{ fontSize: 13 }}>{label}</span>
      {children || <span style={{ fontSize: 13, fontWeight: 600, textAlign: 'right' }}>{value || '—'}</span>}
    </div>
  );
}

export default function AdminPaymentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user: admin } = useAuth();
  const toast = useToast();

  const [payment, setPayment] = useState(location.state?.payment || null);
  const [loading, setLoading] = useState(!location.state?.payment);

  // change-status modal: 'change-to-verified' | 'change-to-rejected'
  const [changeModal, setChangeModal] = useState(null);
  const [sendingModal, setSendingModal] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [reminding, setReminding] = useState(false);

  useEffect(() => {
    if (payment) return;
    (async () => {
      try {
        const { data } = await getAdminPaymentsList({ statuses: [] });
        const list = data.payments || data || [];
        setPayment(list.find((p) => p._id === id) || null);
      } catch (err) {
        toast.error(errMsg(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, payment, toast]);

  if (loading) return <Spinner full />;
  if (!payment) return <Empty title="Payment not found" />;

  const cfg = STATUS[payment.status] || STATUS.pending;
  const { Icon } = cfg;
  const isPending = payment.status === 'paid';     // awaiting verification
  const isVerified = payment.status === 'verified';
  const isRejected = payment.status === 'failed' || payment.status === 'rejected';
  const isNotPaid = payment.status === 'pending';  // member hasn't paid
  const canRemind = isNotPaid || isRejected;
  const memberName = payment.user?.name || payment.user?.phone || 'Member';

  const heroTimestamp = isPending
    ? `Submitted on ${fmtDateTime(payment.paidAt || payment.createdAt)}`
    : isVerified
    ? `Verified on ${fmtDateTime(payment.verifiedAt || payment.updatedAt)}`
    : isRejected
    ? `Rejected on ${fmtDateTime(payment.verifiedAt || payment.updatedAt)}`
    : 'Payment not submitted yet';

  // Verify / Reject (for 'paid'): request OTP then go to full OTP page.
  const navigateToOtp = async (action) => {
    setSendingOtp(true);
    try {
      await requestPaymentActionOtp(payment._id);
    } catch (err) {
      toast.error(errMsg(err));
      setSendingOtp(false);
      return;
    }
    setSendingOtp(false);
    navigate(`/admin/payments/${payment._id}/otp`, {
      state: { action, amount: payment.amount, memberName },
    });
  };

  // Change status (for verified/rejected): request OTP then open inline modal.
  const openChangeModal = async (action) => {
    setSendingModal(true);
    try {
      await requestPaymentActionOtp(payment._id);
      setOtpValue('');
      setOtpError('');
      setChangeModal(action);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSendingModal(false);
    }
  };

  const submitChangeOtp = async () => {
    if (!otpValue.trim()) { setOtpError('Please enter the OTP'); return; }
    setOtpLoading(true);
    setOtpError('');
    try {
      const newStatus = changeModal === 'change-to-verified' ? 'verified' : 'rejected';
      await adminChangePaymentStatus(payment._id, newStatus, otpValue.trim());
      setChangeModal(null);
      toast.success(`Payment marked as ${newStatus}`);
      setTimeout(() => navigate(-1), 700);
    } catch (err) {
      setOtpError(errMsg(err));
    } finally {
      setOtpLoading(false);
    }
  };

  const handleRemind = async () => {
    const msg = isRejected
      ? `Send a reminder to ${memberName} to resubmit their rejected payment?`
      : `Send a payment reminder to ${memberName} for this month's EMI?`;
    if (!window.confirm(msg)) return;
    setReminding(true);
    try {
      const res = await sendPaymentReminder(payment._id);
      toast.success(res.data?.message || 'Reminder sent');
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setReminding(false);
    }
  };

  const verifyGreen = '#10B981';
  const rejectRed = '#EF4444';
  const remindAmber = '#F59E0B';

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
        <div className="card row between mb-16" style={{ background: cfg.bg, border: 'none', alignItems: 'center', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: cfg.fg, marginBottom: 2 }}>
              Month {payment.month} Payment
              {payment.group?.name ? <span style={{ opacity: 0.7, fontWeight: 500 }}> ({payment.group.name})</span> : ''}
            </div>
            <div className="amount" style={{ fontSize: 28, fontWeight: 800, color: cfg.fg }}>{inr(payment.amount)}</div>
            <div style={{ fontSize: 11, color: cfg.fg, opacity: 0.85, marginTop: 3 }}>{heroTimestamp}</div>
          </div>
          <Icon size={40} color={cfg.fg} style={{ flexShrink: 0 }} />
        </div>

        {/* Payment Information */}
        <div className="section-title">Payment Information</div>
        <div className="card mb-16" style={{ padding: '4px 16px' }}>
          <InfoRow label="Member" first>
            <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
              <Avatar name={payment.user?.name} src={payment.user?.avatar} size={28} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>{memberName}</span>
            </div>
          </InfoRow>
          <InfoRow label="Method" value={(payment.paymentMethod || 'UPI').toUpperCase()} />
          <InfoRow label="Month" value={`Month ${payment.month}`} />
          {(payment.paidAt || payment.createdAt) && <InfoRow label="Paid" value={fmtDateTime(payment.paidAt || payment.createdAt)} />}
          {payment.upiTransactionId && <InfoRow label="Transaction ID" value={payment.upiTransactionId} />}
          {payment.upiRef && <InfoRow label="UPI Ref" value={payment.upiRef} />}
          {payment.verifiedBy?.name && <InfoRow label="Verified By" value={payment.verifiedBy.name} />}
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
          <div className="card mb-16 row gap-10" style={{ background: 'var(--st-rejected-bg)', borderColor: 'var(--st-rejected-bd)', alignItems: 'flex-start' }}>
            <IoAlertCircleOutline size={18} color="var(--st-rejected-fg)" style={{ marginTop: 1, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--st-rejected-fg)', marginBottom: 3 }}>Rejection Reason</div>
              <div style={{ fontSize: 12, color: 'var(--st-rejected-fg)', lineHeight: 1.5 }}>{payment.notes}</div>
            </div>
          </div>
        )}

        {/* Pending info */}
        {isNotPaid && (
          <div className="card mb-16 row gap-10" style={{ alignItems: 'flex-start' }}>
            <IoInformationCircleOutline size={18} color="var(--text-secondary)" style={{ marginTop: 1, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>Payment not submitted yet</div>
              <div className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
                No payment has been submitted for this month. You can send a reminder to the member.
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
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{isVerified ? 'Payment Verified' : 'Payment Rejected'}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {fmtDateTime(payment.verifiedAt)}{payment.verifiedBy?.name ? ` by ${payment.verifiedBy.name}` : ''}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Action buttons */}
        <div className="col gap-12">
          {sendingOtp ? (
            <div className="row center gap-8" style={{ height: 48 }}>
              <span className="spinner" /> <span className="muted">Sending OTP…</span>
            </div>
          ) : isPending ? (
            <>
              <button className="btn btn-block" style={{ background: verifyGreen, border: 'none' }} onClick={() => navigateToOtp('verify')}>
                <IoCheckmarkCircleOutline size={18} /> Verify Payment
              </button>
              <button className="btn btn-block" style={{ background: rejectRed, border: 'none' }} onClick={() => navigateToOtp('reject')}>
                <IoCloseCircleOutline size={18} /> Reject Payment
              </button>
            </>
          ) : isVerified ? (
            <button className="btn btn-block" style={{ background: rejectRed, border: 'none' }} onClick={() => openChangeModal('change-to-rejected')} disabled={sendingModal}>
              <IoCloseCircleOutline size={18} /> {sendingModal ? 'Sending…' : 'Change to Rejected'}
            </button>
          ) : isRejected ? (
            <button className="btn btn-block" style={{ background: verifyGreen, border: 'none' }} onClick={() => openChangeModal('change-to-verified')} disabled={sendingModal}>
              <IoCheckmarkCircleOutline size={18} /> {sendingModal ? 'Sending…' : 'Change to Verified'}
            </button>
          ) : null}

          {canRemind && (
            <button className="btn btn-block" style={{ background: remindAmber, border: 'none' }} onClick={handleRemind} disabled={reminding}>
              <IoNotificationsOutline size={18} /> {reminding ? 'Sending…' : 'Send Reminder'}
            </button>
          )}
        </div>
      </div>

      {/* Change-status OTP modal */}
      {changeModal && (
        <div className="modal-backdrop" onMouseDown={() => !otpLoading && setChangeModal(null)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 380, textAlign: 'center' }}>
            <div
              className="center"
              style={{
                width: 72, height: 72, borderRadius: 36, margin: '0 auto 18px',
                background: changeModal === 'change-to-verified' ? 'var(--st-verified-bg)' : 'var(--st-rejected-bg)',
              }}
            >
              {changeModal === 'change-to-verified'
                ? <IoCheckmarkCircle size={32} color={verifyGreen} />
                : <IoCloseCircle size={32} color={rejectRed} />}
            </div>
            <h3 style={{ fontSize: 20, marginBottom: 8 }}>
              {changeModal === 'change-to-verified' ? 'Change to Verified' : 'Change to Rejected'}
            </h3>
            <p className="muted" style={{ fontSize: 13, marginBottom: 22, lineHeight: 1.5 }}>
              Enter the OTP sent to {admin?.phone ? `+91 ${admin.phone}` : 'your phone'} to confirm this change.
            </p>
            <input
              className="input"
              style={{ textAlign: 'center', letterSpacing: 8, fontSize: 18, fontWeight: 600, ...(otpError ? { borderColor: rejectRed } : {}) }}
              inputMode="numeric"
              maxLength={6}
              value={otpValue}
              onChange={(e) => { setOtpValue(e.target.value.replace(/\D/g, '')); setOtpError(''); }}
              placeholder="Enter OTP"
              autoFocus
              disabled={otpLoading}
            />
            {otpError && <div style={{ fontSize: 12, color: rejectRed, marginTop: 6, textAlign: 'left' }}>{otpError}</div>}
            <button
              className="btn btn-block mt-16"
              style={{ background: changeModal === 'change-to-verified' ? verifyGreen : rejectRed, border: 'none' }}
              onClick={submitChangeOtp}
              disabled={otpLoading}
            >
              {otpLoading ? 'Working…' : changeModal === 'change-to-verified' ? 'Confirm Verify' : 'Confirm Reject'}
            </button>
            <button className="btn btn-ghost btn-block mt-8" onClick={() => setChangeModal(null)} disabled={otpLoading}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
