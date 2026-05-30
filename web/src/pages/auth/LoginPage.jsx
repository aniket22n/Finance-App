import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoWallet, IoRadioButtonOn, IoRadioButtonOff, IoAlertCircle } from 'react-icons/io5';
import { useAuth } from '../../context/AuthContext';
import { checkUserType, checkPhone, loginWithPin, sendOtp, extractAuth, errMsg } from '../../services/api';
import CodeBoxes from '../../components/CodeBoxes';
import '../auth.css';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [phone, setPhone] = useState('');
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [mode, setMode] = useState('pin');
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(false);
  const [pinDigits, setPinDigits] = useState(Array(4).fill(''));
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const phoneValid = phone.length === 10;
  const pin = pinDigits.join('');
  const canSubmitPin = phoneValid && pin.length === 4;

  const onPhoneBlur = async () => {
    setPhoneFocused(false);
    if (err) setErr('');
    if (phone.length !== 10) return;
    setChecking(true);
    try {
      const res = await checkUserType(phone);
      const admin = res.data?.isAdmin || false;
      setIsAdmin(admin);
      if (admin) setMode('otp');
    } catch {
      setIsAdmin(false);
    } finally {
      setChecking(false);
    }
  };

  // returns true if phone is registered & can proceed
  const checkRegistration = async () => {
    try {
      const res = await checkPhone(phone);
      if (res.data.pendingRequest) { setErr('Your account is awaiting admin approval.'); return false; }
      if (res.data.rejectedRequest) { setErr('Your account request was rejected. Please contact admin.'); return false; }
      if (!res.data.exists) {
        if (window.confirm('This number has no account. Would you like to sign up?')) {
          navigate('/signup', { state: { phone } });
        }
        return false;
      }
      return true;
    } catch {
      return true;
    }
  };

  const handlePinLogin = async () => {
    if (!canSubmitPin) return;
    setErr('');
    setLoading(true);
    try {
      const ok = await checkRegistration();
      if (!ok) return;
      const res = await loginWithPin(phone, pin);
      const { token, user } = extractAuth(res.data);
      if (!token) throw new Error('Login failed');
      login(token, user);
      navigate('/', { replace: true });
    } catch (e) {
      setErr(errMsg(e) || 'Incorrect PIN. Try again or use OTP.');
      setPinDigits(Array(4).fill(''));
    } finally {
      setLoading(false);
    }
  };

  const handleGetOtp = async () => {
    if (!phoneValid) return;
    setErr('');
    setLoading(true);
    try {
      const ok = await checkRegistration();
      if (!ok) return;
      await sendOtp(phone);
      navigate('/otp', { state: { phone, purpose: 'login' } });
    } catch (e) {
      setErr(errMsg(e) || 'Could not send OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth2">
      <div className="auth2-col">
        <div className="auth2-top center">
          <div className="auth2-logo"><IoWallet size={30} /></div>
          <div className="auth2-title lg">Fast Cash</div>
          <div className="auth2-subtitle">Welcome to Fast Cash</div>
        </div>

        <div className={`auth2-phone ${phoneFocused ? 'focused' : ''}`}>
          <span className="auth2-prefix">+91</span>
          <span className="auth2-divider" />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            onFocus={() => setPhoneFocused(true)}
            onBlur={onPhoneBlur}
            placeholder="9876543210"
            inputMode="numeric"
            maxLength={10}
          />
          {checking && <span className="spinner" style={{ width: 18, height: 18, marginRight: 12 }} />}
        </div>

        {isAdmin && <div className="auth2-admin-note">Admins login with OTP only</div>}

        <div className="auth2-toggle">
          <button
            className={`auth2-toggle-btn ${mode === 'pin' && !isAdmin ? 'active' : ''}`}
            onClick={() => !isAdmin && setMode('pin')}
            disabled={isAdmin}
          >
            {mode === 'pin' && !isAdmin ? <IoRadioButtonOn size={16} /> : <IoRadioButtonOff size={16} />}
            Login with PIN
          </button>
          <button
            className={`auth2-toggle-btn ${mode === 'otp' ? 'active' : ''}`}
            onClick={() => setMode('otp')}
          >
            {mode === 'otp' ? <IoRadioButtonOn size={16} /> : <IoRadioButtonOff size={16} />}
            Login with OTP
          </button>
        </div>

        {mode === 'pin' && !isAdmin && (
          <>
            <div style={{ margin: '24px 0' }}>
              <CodeBoxes digits={pinDigits} setDigits={setPinDigits} error={!!err} secure />
            </div>
            {err && <div className="auth2-error mb-12"><IoAlertCircle size={14} /> {err}</div>}
            <button className="auth2-forgot" onClick={() => navigate('/forgot-pin')}>Forgot PIN?</button>
            <button className="auth2-btn mt-8" onClick={handlePinLogin} disabled={loading || !canSubmitPin}>
              {loading ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : 'Login'}
            </button>
          </>
        )}

        {mode === 'otp' && (
          <>
            {err && <div className="auth2-error mt-16 mb-12"><IoAlertCircle size={14} /> {err}</div>}
            <button className="auth2-btn mt-16" onClick={handleGetOtp} disabled={loading || !phoneValid}>
              {loading ? <span className="spinner" style={{ borderTopColor: '#fff' }} /> : 'Get OTP'}
            </button>
          </>
        )}

        <div className="auth2-footer">
          <div className="auth2-foot-note">By continuing, you agree to our Terms &amp; Privacy Policy</div>
          <div className="auth2-foot-row">
            <span>New here?&nbsp;</span>
            <button className="auth2-link" onClick={() => navigate('/signup')}>Create account</button>
          </div>
        </div>
      </div>
    </div>
  );
}
