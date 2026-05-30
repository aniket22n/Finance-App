import { useNavigate, useLocation } from 'react-router-dom';
import { IoTimeOutline } from 'react-icons/io5';
import '../auth.css';

export default function SignupPendingPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { name, phone } = state || {};

  return (
    <div className="auth2">
      <div className="auth2-col" style={{ textAlign: 'center' }}>
        <div className="pending-icon"><IoTimeOutline size={48} /></div>

        <div className="auth2-title" style={{ textAlign: 'center', marginBottom: 10 }}>Account Request Submitted</div>
        <div className="auth2-subtitle sm" style={{ lineHeight: 1.5, marginBottom: 28 }}>
          Your account request is under review. You'll be notified once the admin approves it.
        </div>

        <div className="pending-card">
          <div className="pending-row">
            <span className="pending-label">Name</span>
            <span className="pending-value">{name || '—'}</span>
          </div>
          <div className="pending-row">
            <span className="pending-label">Phone</span>
            <span className="pending-value">+91 {phone || '—'}</span>
          </div>
          <div className="pending-row">
            <span className="pending-label">Status</span>
            <span className="pending-badge">Pending Review</span>
          </div>
        </div>

        <button className="auth2-btn" onClick={() => navigate('/login', { replace: true })}>Got it</button>
      </div>
    </div>
  );
}
