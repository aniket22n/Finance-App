import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { IoArrowBack, IoAlertCircle } from 'react-icons/io5';
import { checkPhone, sendOtp, errMsg } from '../../services/api';
import '../auth.css';

export default function SignUpPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState(state?.phone || '');
  const [phoneError, setPhoneError] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = firstName.trim() && lastName.trim() && phone.length === 10;

  const handleSendOtp = async () => {
    setPhoneError('');
    if (!firstName.trim()) return setPhoneError('Enter your first name');
    if (!lastName.trim()) return setPhoneError('Enter your last name');
    if (phone.length !== 10) return setPhoneError('Enter a valid 10-digit phone number');
    setLoading(true);
    try {
      const res = await checkPhone(phone);
      if (res.data.exists) return setPhoneError('This number is already registered. Please log in.');
      if (res.data.pendingRequest) return setPhoneError('Account request already submitted. Please wait for admin approval.');
      if (res.data.rejectedRequest) return setPhoneError('Previous request was rejected. Please contact admin.');
      await sendOtp(phone);
      navigate('/signup-otp', { state: { phone, firstName: firstName.trim(), lastName: lastName.trim() } });
    } catch (err) {
      setPhoneError(errMsg(err) || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth2">
      <div className="auth2-col">
        <button className="auth2-back" onClick={() => navigate(-1)}><IoArrowBack size={22} /></button>

        <div className="auth2-top">
          <div className="auth2-title">Create Account</div>
          <div className="auth2-subtitle sm">Join your EMI group as a member</div>
        </div>

        <input className="input mb-12" placeholder="First Name" value={firstName}
          onChange={(e) => setFirstName(e.target.value)} style={inputStyle} />
        <input className="input mb-12" placeholder="Last Name" value={lastName}
          onChange={(e) => setLastName(e.target.value)} style={inputStyle} />

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

        <button className="auth2-btn mt-24" onClick={handleSendOtp} disabled={loading || !canSubmit}>
          {loading ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : 'Send OTP'}
        </button>

        <div className="auth2-foot-row mt-16" style={{ justifyContent: 'center' }}>
          <span>Already have an account?&nbsp;</span>
          <button className="auth2-link" onClick={() => navigate('/login')}>Log in</button>
        </div>
      </div>
    </div>
  );
}

const inputStyle = { height: 56, background: 'var(--background-secondary)' };
