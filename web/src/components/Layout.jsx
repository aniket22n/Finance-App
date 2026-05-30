import { NavLink } from 'react-router-dom';
import {
  IoHome, IoHomeOutline, IoPeople, IoPeopleOutline, IoCard, IoCardOutline,
  IoPerson, IoPersonOutline, IoGrid, IoGridOutline, IoShield, IoShieldOutline,
} from 'react-icons/io5';
import { useAuth } from '../context/AuthContext';
import './layout.css';

// Bottom tab bar — mirrors the mobile MainTabs exactly.
// Member: Home · Groups · Payments · Profile
// Admin:  Dashboard · Groups · Payments · Admin(Controls) · Profile
// (Account Requests / Analytics are reached from within, like the app.)
const MEMBER_NAV = [
  { to: '/', label: 'Home', on: IoHome, off: IoHomeOutline, end: true },
  { to: '/groups', label: 'Groups', on: IoPeople, off: IoPeopleOutline },
  { to: '/payments', label: 'Payments', on: IoCard, off: IoCardOutline },
  { to: '/profile', label: 'Profile', on: IoPerson, off: IoPersonOutline },
];

const ADMIN_NAV = [
  { to: '/admin', label: 'Home', on: IoGrid, off: IoGridOutline, end: true },
  { to: '/admin/groups', label: 'Groups', on: IoPeople, off: IoPeopleOutline },
  { to: '/admin/payments', label: 'Payments', on: IoCard, off: IoCardOutline },
  { to: '/admin/controls', label: 'Admin', on: IoShield, off: IoShieldOutline },
  { to: '/profile', label: 'Profile', on: IoPerson, off: IoPersonOutline },
];

export default function Layout({ children }) {
  const { isAdmin } = useAuth();
  const nav = isAdmin ? ADMIN_NAV : MEMBER_NAV;

  return (
    <div className="app-shell">
      <div className="phone">
        <main className="phone-content">{children}</main>

        <nav className="tabbar">
          {nav.map(({ to, label, on: On, off: Off, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
              {({ isActive }) => (
                <>
                  {isActive ? <On size={24} /> : <Off size={24} />}
                  <span className="tab-label">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
