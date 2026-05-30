import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoArrowBack, IoAlertCircle } from 'react-icons/io5';
import { sendOtp, errMsg } from '../../services/api';
import '../auth.css';

export default function ForgotPINPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [loading, setLoading] = useState(false);

  const phoneValid = phone.length === 10;

  const handleSend = async () => {
    setPhoneError('');
    if (!phoneValid) return setPhoneError('Enter a valid 10-digit phone number');
    setLoading(true);
    try {
      await sendOtp(phone);
      navigate('/reset-pin-otp', { state: { phone } });
    } catch (err) {
      setPhoneError(errMsg(err) || 'Could not send OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth2">
      <div className="auth2-col">
        <button className="auth2-back" onClick={() => navigate(-1)}><IoArrowBack size={22} /></button>

        <div className="auth2-top">
          <div className="auth2-title">Forgot PIN?</div>
          <div className="auth2-subtitle sm">We'll help you reset your PIN</div>
        </div>

        <div className={`auth2-phone ${phoneError ? 'err' : ''}`}>
          <span className="auth2-prefix">+91</span>
          <span className="auth2-divider" />
          <input
            value={phone}
            onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setPhoneError(''); }}
            placeholder="9876543210" inputMode="numeric" maxLength={10}
          />
        </div>
        {phoneError && <div className="auth2-error mt-8"><IoAlertCircle size={13} /> {phoneError}</div>}

        <button className="auth2-btn mt-24" onClick={handleSend} disabled={loading || !phoneValid}>
          {loading ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : 'Send OTP'}
        </button>
      </div>
    </div>
  );
}
