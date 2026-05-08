import { useState } from 'react'
import { sendBulkNotify, createBackup } from '../services/api'

export default function Settings() {
    const [notifTitle, setNotifTitle] = useState('')
    const [notifBody, setNotifBody] = useState('')
    const [sending, setSending] = useState(false)
    const [backing, setBacking] = useState(false)

    const handleSendNotification = async (e) => {
        e.preventDefault()
        if (!notifTitle || !notifBody) return
        setSending(true)
        try {
            const res = await sendBulkNotify({ title: notifTitle, body: notifBody })
            alert(`Notification sent to ${res.data.sent} users!`)
            setNotifTitle('')
            setNotifBody('')
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to send')
        } finally {
            setSending(false)
        }
    }

    const handleBackup = async () => {
        setBacking(true)
        try {
            const res = await createBackup()
            // Download the backup as JSON file
            const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `emi-backup-${new Date().toISOString().split('T')[0]}.json`
            a.click()
            URL.revokeObjectURL(url)
        } catch (err) {
            alert(err.response?.data?.error || 'Backup failed')
        } finally {
            setBacking(false)
        }
    }

    return (
        <div>
            <div className="page-header">
                <h1>Settings</h1>
            </div>

            {/* Bulk Notifications */}
            <div className="stat-card" style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>📣 Bulk Notifications</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
                    Send push notifications to all active members across all groups.
                </p>
                <form onSubmit={handleSendNotification}>
                    <div className="form-group" style={{ marginBottom: 12 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                            Title
                        </label>
                        <input
                            value={notifTitle} onChange={e => setNotifTitle(e.target.value)}
                            placeholder="Notification title" style={{ width: '100%' }} required
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                            Message
                        </label>
                        <textarea
                            value={notifBody} onChange={e => setNotifBody(e.target.value)}
                            placeholder="Notification message" rows={3}
                            style={{ width: '100%', resize: 'vertical' }} required
                        />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={sending}>
                        {sending ? 'Sending...' : '📤 Send to All'}
                    </button>
                </form>
            </div>

            {/* Automated Reminders */}
            <div className="stat-card" style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>⏰ Automated Reminders</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
                    The system automatically checks for upcoming, due, and overdue payments every day at 10:00 AM. 
                    You can also manually trigger the reminder cycle right now.
                </p>
                <button 
                    className="btn btn-primary" 
                    onClick={async () => {
                        try {
                            const { triggerReminders } = await import('../services/api');
                            await triggerReminders();
                            alert('Reminders triggered successfully!');
                        } catch (e) {
                            alert('Failed to trigger reminders');
                        }
                    }}
                >
                    🚀 Trigger Reminders Now
                </button>
            </div>

            {/* Backup */}
            <div className="stat-card" style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>💾 Database Backup</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
                    Download a full JSON export of all groups, members, payments, and EMI cycles.
                </p>
                <button className="btn btn-success" onClick={handleBackup} disabled={backing}>
                    {backing ? 'Exporting...' : '⬇️ Download Backup'}
                </button>
            </div>

            {/* App Info */}
            <div className="stat-card">
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>ℹ️ App Information</h3>
                <div style={{ display: 'grid', gap: 10 }}>
                    {[
                        ['App Version', '1.0.0'],
                        ['Backend', 'Node.js + Express'],
                        ['Database', 'MongoDB Atlas (Free Tier)'],
                        ['Notifications', 'Expo Push (Free)'],
                        ['Payments', 'UPI Deep Links (Free)'],
                        ['Hosting', 'Render.com (Free Tier)'],
                        ['Monthly Cost', '$0 ✅'],
                    ].map(([key, val]) => (
                        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{key}</span>
                            <span style={{ fontWeight: 600, fontSize: 13 }}>{val}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
