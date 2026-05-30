import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { IoArrowBack, IoAlertCircle } from 'react-icons/io5';
import { resetPin as resetPinApi, errMsg } from '../../services/api';
import { useToast } from '../../components/Toast';
import CodeBoxes from '../../components/CodeBoxes';
import '../auth.css';

export default function ResetPINPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { state } = useLocation();
  const [pinDigits, setPinDigits] = useState(Array(4).fill(''));
  const [confirmDigits, setConfirmDigits] = useState(Array(4).fill(''));
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  if (!state?.phone) return <Navigate to="/forgot-pin" replace />;
  const { phone } = state;

  const pin = pinDigits.join('');
  const confirmPin = confirmDigits.join('');
  const canSubmit = pin.length === 4 && confirmPin.length === 4;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (pin !== confirmPin) {
      setErr('PINs do not match. Try again.');
      setConfirmDigits(Array(4).fill(''));
      return;
    }
    setErr('');
    setLoading(true);
    try {
      await resetPinApi(phone, pin);
      toast.success('PIN updated successfully');
      setTimeout(() => navigate('/login', { replace: true }), 900);
    } catch (e) {
      setErr(errMsg(e) || 'Could not update PIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth2">
      <div className="auth2-col">
        <button className="auth2-back" onClick={() => navigate(-1)}><IoArrowBack size={22} /></button>

        <div className="auth2-top">
          <div className="auth2-title">Set New PIN</div>
          <div className="auth2-subtitle sm">Create a 4-digit PIN</div>
        </div>

        <div className="mb-16"><CodeBoxes digits={pinDigits} setDigits={setPinDigits} secure /></div>
        <div className="auth2-confirm-label">Confirm PIN</div>
        <div><CodeBoxes digits={confirmDigits} setDigits={setConfirmDigits} error={!!err} secure /></div>

        {err && <div className="auth2-error mt-12"><IoAlertCircle size={14} /> {err}</div>}

        <button className="auth2-btn mt-24" onClick={handleSubmit} disabled={loading || !canSubmit}>
          {loading ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : 'Update PIN'}
        </button>
      </div>
    </div>
  );
}
