import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IoCreateOutline, IoDocumentTextOutline, IoMoon, IoSunny, IoLogOutOutline,
  IoChevronForward, IoPerson, IoCheckmark, IoClose,
} from 'react-icons/io5';
import { useAuth } from '../context/AuthContext';
import { useTheme, AVAILABLE_THEMES, THEME_SWATCH } from '../context/ThemeContext';
import { updateProfile, errMsg } from '../services/api';
import { useToast } from '../components/Toast';

function splitLegacyName(n) {
  const parts = String(n || '').trim().split(/\s+/);
  return { first: parts[0] || '', last: parts.slice(1).join(' ') };
}

function MenuItem({ Icon, label, onClick, danger, last }) {
  return (
    <button
      className="prof-menu-item"
      onClick={onClick}
      style={{ borderBottom: last ? 'none' : '1px solid var(--border)' }}
    >
      <Icon size={18} color={danger ? 'var(--error)' : 'var(--text)'} />
      <span style={{ flex: 1, textAlign: 'left', fontSize: 14, color: danger ? 'var(--error)' : 'var(--text)' }}>{label}</span>
      <IoChevronForward size={16} color={danger ? 'var(--error)' : 'var(--text-secondary)'} />
    </button>
  );
}

export default function ProfilePage() {
  const { user, updateUser, logout } = useAuth();
  const { isDark, setIsDark, primaryTheme, setPrimaryTheme } = useTheme();
  const navigate = useNavigate();
  const toast = useToast();

  const legacy = splitLegacyName(user?.name);
  const [showEdit, setShowEdit] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName || legacy.first);
  const [lastName, setLastName] = useState(user?.lastName || legacy.last);
  const [email, setEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);

  const openEdit = () => {
    const lg = splitLegacyName(user?.name);
    setFirstName(user?.firstName || lg.first);
    setLastName(user?.lastName || lg.last);
    setEmail(user?.email || '');
    setShowEdit(true);
  };

  const handleSave = async () => {
    if (!firstName.trim()) return toast.show('First name is required', 'info');
    if (!lastName.trim()) return toast.show('Last name is required', 'info');
    setSaving(true);
    try {
      const res = await updateProfile({ firstName: firstName.trim(), lastName: lastName.trim(), email });
      updateUser(res.data.user || { ...user, firstName, lastName, email });
      setShowEdit(false);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: 'var(--background-secondary)', minHeight: '100%' }}>
      <header className="app-header"><h1>Profile</h1></header>

      <div className="screen">
        {/* Gradient profile card */}
        <div className="row gap-16" style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', borderRadius: 14, padding: 16, marginTop: 2 }}>
          <span className="center" style={{ width: 52, height: 52, borderRadius: 26, background: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>
            <IoPerson size={34} color="#fff" />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>{user?.name || 'Set your name'}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>+91 {user?.phone}</div>
            <span style={{ display: 'inline-block', background: 'var(--success)', color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: 0.4, padding: '3px 9px', borderRadius: 6, marginTop: 7 }}>
              {user?.role?.toUpperCase()}
            </span>
          </div>
        </div>

        {/* ACCOUNT */}
        <div className="prof-section">ACCOUNT</div>
        <div className="prof-card">
          <MenuItem Icon={IoCreateOutline} label="Edit Profile" onClick={openEdit} />
          <MenuItem Icon={IoDocumentTextOutline} label="Privacy Policy" last onClick={() => toast.show('Available at emigroup.app/privacy', 'info')} />
        </div>

        {/* APPEARANCE */}
        <div className="prof-section">APPEARANCE</div>
        <div className="prof-card">
          <div className="prof-menu-item" style={{ cursor: 'default', borderBottom: '1px solid var(--border)' }}>
            {isDark ? <IoMoon size={18} color="var(--primary)" /> : <IoSunny size={18} color="var(--warning)" />}
            <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{isDark ? 'Dark Mode' : 'Light Mode'}</span>
            <label className="switch">
              <input type="checkbox" checked={isDark} onChange={(e) => setIsDark(e.target.checked)} />
              <span className="track"><span className="knob" /></span>
            </label>
          </div>
          <div style={{ padding: '14px 16px' }}>
            <div className="muted" style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Primary Color</div>
            <div className="row between">
              {Object.keys(AVAILABLE_THEMES).map((key) => {
                const selected = primaryTheme === key;
                return (
                  <button key={key} onClick={() => setPrimaryTheme(key)} title={AVAILABLE_THEMES[key]}
                    className="center"
                    style={{
                      width: 52, height: 52, borderRadius: 12, background: THEME_SWATCH[key], cursor: 'pointer',
                      border: selected ? '3px solid var(--text)' : '3px solid transparent',
                    }}>
                    {selected && <IoCheckmark size={20} color="#fff" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* DANGER ZONE */}
        <div className="prof-section">DANGER ZONE</div>
        <div className="prof-card">
          <MenuItem Icon={IoLogOutOutline} label="Logout" danger last onClick={() => setConfirmLogout(true)} />
        </div>

        <div className="muted" style={{ textAlign: 'center', fontSize: 12, marginTop: 24 }}>EMI Group v1.0.0</div>
      </div>

      {/* Edit Profile sheet */}
      {showEdit && (
        <div className="sheet-backdrop" onMouseDown={() => setShowEdit(false)}>
          <div className="sheet" onMouseDown={(e) => e.stopPropagation()} style={{ padding: '0 24px 36px' }}>
            <div className="sheet-handle" />
            <div className="row between mb-16">
              <h3 style={{ fontSize: 18 }}>Edit Profile</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowEdit(false)} style={{ border: 'none' }}><IoClose size={22} /></button>
            </div>
            <div className="field"><label>First Name</label>
              <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" autoFocus /></div>
            <div className="field"><label>Last Name</label>
              <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" /></div>
            <div className="field"><label>Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" /></div>
            <div className="field"><label>Phone (cannot change)</label>
              <input className="input" value={user?.phone || ''} disabled /></div>
            <button className="btn btn-block mt-8" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </div>
      )}

      {/* Logout confirm */}
      {confirmLogout && (
        <div className="modal-backdrop" onMouseDown={() => setConfirmLogout(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <h3 style={{ fontSize: 18, marginBottom: 8 }}>Logout</h3>
            <p className="muted" style={{ fontSize: 14, marginBottom: 24 }}>Are you sure you want to logout?</p>
            <div className="row gap-12">
              <button className="btn btn-ghost grow" onClick={() => setConfirmLogout(false)}>Cancel</button>
              <button className="btn grow" style={{ background: 'var(--error)', border: 'none', color: '#fff' }}
                onClick={() => { setConfirmLogout(false); logout(); navigate('/login', { replace: true }); }}>Logout</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
