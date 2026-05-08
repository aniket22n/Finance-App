import { useState } from 'react'
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Groups from './pages/Groups'
import GroupDetail from './pages/GroupDetail'
import Members from './pages/Members'
import Payments from './pages/Payments'
import Settings from './pages/Settings'
import Login from './pages/Login'

function Sidebar() {
    const navigate = useNavigate()

    const handleLogout = () => {
        localStorage.removeItem('adminToken')
        navigate('/login')
    }

    const navItems = [
        { path: '/', icon: '📊', label: 'Dashboard' },
        { path: '/groups', icon: '👥', label: 'Groups' },
        { path: '/members', icon: '🧑', label: 'Members' },
        { path: '/payments', icon: '💳', label: 'Payments' },
        { path: '/settings', icon: '⚙️', label: 'Settings' },
    ]

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <div className="logo-icon">💰</div>
                <h2>EMI Admin</h2>
            </div>
            <ul className="sidebar-nav">
                {navItems.map(item => (
                    <li key={item.path}>
                        <NavLink
                            to={item.path}
                            end={item.path === '/'}
                            className={({ isActive }) => isActive ? 'active' : ''}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            {item.label}
                        </NavLink>
                    </li>
                ))}
                <li style={{ marginTop: 24 }}>
                    <a onClick={handleLogout} style={{ cursor: 'pointer' }}>
                        <span className="nav-icon">🚪</span>
                        Logout
                    </a>
                </li>
            </ul>
        </aside>
    )
}

function ProtectedLayout() {
    const token = localStorage.getItem('adminToken')
    if (!token) return <Navigate to="/login" replace />

    return (
        <div className="app-layout">
            <Sidebar />
            <main className="main-content">
                <Routes>
                    <Route index element={<Dashboard />} />
                    <Route path="groups" element={<Groups />} />
                    <Route path="groups/:id" element={<GroupDetail />} />
                    <Route path="members" element={<Members />} />
                    <Route path="payments" element={<Payments />} />
                    <Route path="settings" element={<Settings />} />
                </Routes>
            </main>
        </div>
    )
}

export default function App() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={<ProtectedLayout />} />
        </Routes>
    )
}
