import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { IoArrowBack, IoAlertCircle } from 'react-icons/io5';
import {
  adminVerifyPayment, adminRejectPayment, adminChangePaymentStatus,
  requestPaymentActionOtp, errMsg,
} from '../../services/api';
import { useToast } from '../../components/Toast';
import CodeBoxes from '../../components/CodeBoxes';
import { inr } from '../../utils/format';

const OTP_LENGTH = 4;

// Mirrors mobile AdminPaymentOTPScreen ACTION_META.
const ACTION_META = {
  'verify':             { title: 'Verify Payment',    desc: 'Enter OTP to verify this payment',          color: '#10B981' },
  'reject':             { title: 'Reject Payment',    desc: 'Enter OTP to reject this payment',           color: '#EF4444' },
  'change-to-verified': { title: 'Change to Verified', desc: 'Enter OTP to mark this payment as verified', color: '#10B981' },
  'change-to-rejected': { title: 'Change to Rejected', desc: 'Enter OTP to mark this payment as rejected', color: '#EF4444' },
};

export default function AdminPaymentOTPPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const { action = 'verify', amount, memberName } = location.state || {};
  const meta = ACTION_META[action] || ACTION_META.verify;
  const isRejectAction = action === 'reject' || action === 'change-to-rejected';

  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''));
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const otp = digits.join('');
  const canConfirm = otp.length === OTP_LENGTH;

  const handleConfirm = async () => {
    if (!canConfirm || loading) return;
    setError('');
    setLoading(true);
    try {
      if (action === 'verify') await adminVerifyPayment(id, otp);
      else if (action === 'reject') await adminRejectPayment(id, otp, reason.trim() || undefined);
      else if (action === 'change-to-verified') await adminChangePaymentStatus(id, 'verified', otp);
      else if (action === 'change-to-rejected') await adminChangePaymentStatus(id, 'rejected', otp, reason.trim() || undefined);

      const accepted = action === 'verify' || action === 'change-to-verified';
      toast.success(accepted ? 'Payment verified' : 'Payment rejected');
      navigate('/admin/payments', { replace: true, state: { filter: accepted ? 'verified' : 'rejected' } });
    } catch (err) {
      setError(errMsg(err) || 'Action failed. Check your OTP.');
      setDigits(Array(OTP_LENGTH).fill(''));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    setDigits(Array(OTP_LENGTH).fill(''));
    try {
      await requestPaymentActionOtp(id);
      toast.success('OTP sent');
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <div>
      <header className="app-header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} disabled={loading}>
          <IoArrowBack size={16} /> Back
        </button>
      </header>

      <div className="screen" style={{ maxWidth: 460, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, color: meta.color, marginBottom: 6 }}>{meta.title}</h1>
        <p className="muted" style={{ fontSize: 13, marginBottom: 4 }}>{meta.desc}</p>
        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 24 }}>
          {amount != null ? inr(amount) : ''}{memberName ? ` · ${memberName}` : ''}
        </p>

        {isRejectAction && (
          <div className="field">
            <label>Rejection Reason <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
            <textarea
              className="input"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Wrong UPI ref, blurry receipt…"
              disabled={loading}
            />
          </div>
        )}

        <div className="mb-16" style={{ display: 'flex', justifyContent: 'center' }}>
          <CodeBoxes digits={digits} setDigits={setDigits} error={!!error} autoFocus />
        </div>

        {error && (
          <div className="row gap-6 mb-16" style={{ padding: '8px 12px', background: 'var(--error-light)', border: '1px solid var(--error)', borderRadius: 8 }}>
            <IoAlertCircle size={14} color="var(--error)" />
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--error)' }}>{error}</span>
          </div>
        )}

        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <button className="btn btn-ghost btn-sm" onClick={handleResend} disabled={loading || resending} style={{ textDecoration: 'underline', border: 'none', background: 'none' }}>
            {resending ? 'Sending…' : 'Resend OTP'}
          </button>
        </div>

        <button
          className="btn btn-block"
          style={{ background: meta.color, border: 'none', opacity: !canConfirm || loading ? 0.45 : 1 }}
          onClick={handleConfirm}
          disabled={!canConfirm || loading}
        >
          {loading ? 'Working…' : 'Confirm'}
        </button>
      </div>
    </div>
  );
}
