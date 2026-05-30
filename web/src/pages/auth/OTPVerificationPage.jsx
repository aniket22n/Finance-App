import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import OtpScreen from '../../components/OtpScreen';
import { useAuth } from '../../context/AuthContext';
import { verifyOtp, sendOtp, hasPin, extractAuth, errMsg } from '../../services/api';

export default function OTPVerificationPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { state } = useLocation();
  const [busy, setBusy] = useState(false);
  if (!state?.phone) return <Navigate to="/login" replace />;
  const { phone, purpose = 'login' } = state;

  const onVerify = async (otp, { setError }) => {
    if (purpose === 'reset') {
      navigate('/reset-pin-otp', { state: { phone, otp }, replace: true });
      return;
    }
    setBusy(true);
    try {
      const res = await verifyOtp(phone, otp);
      const { token, user } = extractAuth(res.data);
      if (user?.role === 'admin') {
        login(token, user);
        navigate('/', { replace: true });
        return;
      }
      // Member: if no PIN set yet, route to SetPIN; otherwise log in.
      let pinExists = true;
      try { const r = await hasPin(phone); pinExists = r.data?.hasPin ?? r.data?.exists ?? true; } catch { pinExists = true; }
      if (!pinExists) {
        navigate('/set-pin', { state: { phone, token, user, mode: 'login' }, replace: true });
      } else {
        login(token, user);
        navigate('/', { replace: true });
      }
    } catch (e) {
      const status = e?.response?.status;
      if (status === 404) {
        if (window.confirm('This phone number is not registered. Would you like to create an account?')) {
          navigate('/signup', { state: { phone }, replace: true });
        }
      } else {
        setError(errMsg(e) || 'Invalid OTP');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <OtpScreen
      phone={phone}
      busy={busy}
      onVerify={onVerify}
      onResend={() => sendOtp(phone)}
    />
  );
}
