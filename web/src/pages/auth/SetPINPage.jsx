import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { IoArrowBack, IoAlertCircle } from 'react-icons/io5';
import { useAuth } from '../../context/AuthContext';
import { signup, setPin as setPinApi, extractAuth, errMsg } from '../../services/api';
import CodeBoxes from '../../components/CodeBoxes';
import '../auth.css';

export default function SetPINPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { state } = useLocation();
  const [pinDigits, setPinDigits] = useState(Array(4).fill(''));
  const [confirmDigits, setConfirmDigits] = useState(Array(4).fill(''));
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  if (!state?.phone) return <Navigate to="/login" replace />;
  const { phone, otp, firstName, lastName, token, user, mode = 'signup' } = state;

  const pin = pinDigits.join('');
  const confirmPin = confirmDigits.join('');
  const canSubmit = pin.length === 4 && confirmPin.length === 4;
  const buttonLabel = mode === 'signup' ? 'Create Account' : 'Continue';

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
      if (mode === 'signup') {
        const res = await signup({ firstName, lastName, phone, otp, pin });
        navigate('/signup-pending', {
          state: { name: res.data.user?.name, phone: res.data.user?.phone || phone },
          replace: true,
        });
      } else {
        await setPinApi(phone, pin);
        login(token, user);
        navigate('/', { replace: true });
      }
    } catch (e) {
      setErr(errMsg(e) || 'Could not set PIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth2">
      <div className="auth2-col">
        <button className="auth2-back" onClick={() => navigate(-1)}><IoArrowBack size={22} /></button>

        <div className="auth2-top">
          <div className="auth2-title">Set Your PIN</div>
          <div className="auth2-subtitle sm">Create a 4-digit PIN for easy login</div>
        </div>

        <div className="mb-16"><CodeBoxes digits={pinDigits} setDigits={setPinDigits} secure /></div>
        <div className="auth2-confirm-label">Confirm your PIN</div>
        <div><CodeBoxes digits={confirmDigits} setDigits={setConfirmDigits} error={!!err} secure /></div>

        {err && <div className="auth2-error mt-12"><IoAlertCircle size={14} /> {err}</div>}

        <button className="auth2-btn mt-24" onClick={handleSubmit} disabled={loading || !canSubmit}>
          {loading ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : buttonLabel}
        </button>
      </div>
    </div>
  );
}
