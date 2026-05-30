import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoArrowBack, IoAlertCircle } from 'react-icons/io5';
import CodeBoxes from './CodeBoxes';
import { useToast } from './Toast';
import '../pages/auth.css';

const RESEND_SECONDS = 30;

// Shared "Verify OTP" screen (mirrors mobile SignUpOTP / OTPVerification / ResetPINOTP).
// onVerify(otp) and onResend() are provided by each page; error is shown inline.
export default function OtpScreen({ phone, onVerify, onResend, busy }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [digits, setDigits] = useState(Array(4).fill(''));
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');

  const otp = digits.join('');
  const canVerify = otp.length === 4;

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  const verify = async () => {
    if (!canVerify) return;
    setError('');
    try {
      await onVerify(otp, { setError, reset: () => setDigits(Array(4).fill('')) });
    } catch (e) {
      setError(e?.message || 'Invalid OTP');
      setDigits(Array(4).fill(''));
    }
  };

  const resend = async () => {
    if (seconds > 0) return;
    setResending(true);
    try {
      await onResend();
      setSeconds(RESEND_SECONDS);
      setDigits(Array(4).fill(''));
    } catch (e) {
      toast.error(e?.message || 'Could not resend OTP');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth2">
      <div className="auth2-col">
        <button className="auth2-back" onClick={() => navigate(-1)}><IoArrowBack size={22} /></button>

        <div className="auth2-title">Verify OTP</div>
        <div className="auth2-subtitle sm" style={{ marginBottom: 4 }}>OTP sent to +91 {phone}</div>
        <div className="auth2-timer" style={{ marginBottom: 32 }}>
          {seconds > 0 ? `Resend in ${seconds}s` : 'You can resend now'}
        </div>

        <CodeBoxes digits={digits} setDigits={setDigits} error={!!error} autoFocus />

        {error && <div className="auth2-error mt-16"><IoAlertCircle size={14} /> {error}</div>}

        <button className="auth2-btn mt-24" onClick={verify} disabled={busy || !canVerify}>
          {busy ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : 'Verify'}
        </button>

        <button className="auth2-resend" onClick={resend} disabled={seconds > 0 || resending}>
          {resending ? '…' : 'Resend OTP'}
        </button>
      </div>
    </div>
  );
}
