import { useState, useEffect } from 'react'
import { getDashboard, getRevenueAnalytics, getOverduePayments, getGroupHealth } from '../services/api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export default function Dashboard() {
    const [data, setData] = useState(null)
    const [revenueData, setRevenueData] = useState([])
    const [overdueData, setOverdueData] = useState([])
    const [groupHealth, setGroupHealth] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadDashboard()
    }, [])

    const loadDashboard = async () => {
        try {
            const [res, revRes, overdueRes, healthRes] = await Promise.all([
                getDashboard(),
                getRevenueAnalytics().catch(() => ({ data: { revenue: [] } })),
                getOverduePayments().catch(() => ({ data: { overdue: [] } })),
                getGroupHealth().catch(() => ({ data: { groups: [] } }))
            ])
            setData(res.data)
            setRevenueData(revRes.data.revenue || [])
            setOverdueData(overdueRes.data.overdue || [])
            setGroupHealth(healthRes.data.groups || [])
        } catch (err) {
            console.error('Dashboard error:', err)
        } finally {
            setLoading(false)
        }
    }

    if (loading) return <div style={{ color: 'var(--text-secondary)', padding: 40 }}>Loading dashboard...</div>

    const stats = data?.stats || {}

    const exportCSV = () => {
        if (!data?.recentPayments) return;
        const csvRows = [
            ['Member', 'Group', 'Amount', 'Status', 'Date'],
            ...data.recentPayments.map(p => [
                p.user?.name || p.user?.phone || 'Unknown',
                p.group?.name || 'Unknown',
                p.amount,
                p.status,
                new Date(p.createdAt).toLocaleDateString()
            ])
        ];
        const csvString = csvRows.map(e => e.join(",")).join("\n");
        const blob = new Blob([csvString], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', 'recent_payments_report.csv');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <div>
            <div className="page-header">
                <h1>Dashboard</h1>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-outline" onClick={exportCSV}>⬇️ Export CSV</button>
                    <button className="btn btn-primary" onClick={loadDashboard}>🔄 Refresh</button>
                </div>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'rgba(233,69,96,0.15)' }}>👥</div>
                    <div className="stat-value">{stats.totalGroups || 0}</div>
                    <div className="stat-label">Total Groups</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'rgba(0,184,148,0.15)' }}>✅</div>
                    <div className="stat-value">{stats.activeGroups || 0}</div>
                    <div className="stat-label">Active Groups</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'rgba(108,92,231,0.15)' }}>🧑</div>
                    <div className="stat-value">{stats.totalUsers || 0}</div>
                    <div className="stat-label">Total Members</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'rgba(240,165,0,0.15)' }}>💰</div>
                    <div className="stat-value">₹{(stats.verifiedAmount || 0).toLocaleString()}</div>
                    <div className="stat-label">Collected</div>
                </div>
            </div>

            {/* Revenue Analytics Chart */}
            <div className="stat-card" style={{ marginTop: 24, marginBottom: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>📈 Monthly Revenue</h3>
                {revenueData.length > 0 ? (
                    <div style={{ height: 300, width: '100%' }}>
                        <ResponsiveContainer>
                            <BarChart data={revenueData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                                <XAxis dataKey="name" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)' }} />
                                <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)' }} tickFormatter={(val) => `₹${val}`} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    contentStyle={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)', borderRadius: 8 }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Bar dataKey="amount" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                        No revenue data available yet.
                    </div>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Pending Payments */}
                <div className="stat-card">
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>⏳ Pending Payments</h3>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Count</span>
                        <span style={{ fontWeight: 700 }}>{stats.pendingCount || 0}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Amount</span>
                        <span style={{ fontWeight: 700, color: 'var(--warning)' }}>₹{(stats.pendingAmount || 0).toLocaleString()}</span>
                    </div>
                </div>

                {/* Verified Payments */}
                <div className="stat-card">
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>✅ Verified Payments</h3>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Count</span>
                        <span style={{ fontWeight: 700 }}>{stats.verifiedCount || 0}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Amount</span>
                        <span style={{ fontWeight: 700, color: 'var(--success)' }}>₹{(stats.verifiedAmount || 0).toLocaleString()}</span>
                    </div>
                </div>
            </div>

            {/* Overdue Payments */}
            {overdueData.length > 0 && (
                <div className="stat-card" style={{ marginTop: 16, borderColor: 'var(--danger)' }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--danger)' }}>
                        🚨 Overdue Payments ({overdueData.length})
                    </h3>
                    <table className="data-table">
                        <thead>
                            <tr><th>Member</th><th>Group</th><th>Amount</th><th>Pending Since</th></tr>
                        </thead>
                        <tbody>
                            {overdueData.slice(0, 5).map(p => (
                                <tr key={p._id}>
                                    <td>{p.user?.name || p.user?.phone || '—'}</td>
                                    <td>{p.group?.name || '—'}</td>
                                    <td style={{ fontWeight: 700 }}>₹{p.amount?.toLocaleString()}</td>
                                    <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Group Health */}
            {groupHealth.length > 0 && (
                <div className="stat-card" style={{ marginTop: 16 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>🏥 Group Payment Health</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                        {groupHealth.map(g => (
                            <div key={g._id} style={{ background: 'var(--bg-primary)', padding: 12, borderRadius: 8 }}>
                                <div style={{ fontWeight: 600, marginBottom: 8 }}>{g.name}</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Paid</span>
                                    <span style={{ color: 'var(--success)' }}>{g.paid}/{g.totalMembers}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Pending</span>
                                    <span style={{ color: 'var(--warning)' }}>{g.pending}</span>
                                </div>
                                <div style={{ marginTop: 8, height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${g.percentage}%`, background: g.percentage >= 80 ? 'var(--success)' : g.percentage >= 50 ? 'var(--warning)' : 'var(--danger)', borderRadius: 3 }} />
                                </div>
                                <div style={{ textAlign: 'center', fontSize: 12, marginTop: 4, color: 'var(--text-secondary)' }}>{g.percentage}% paid</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recent Payments */}
            {data?.recentPayments?.length > 0 && (
                <div style={{ marginTop: 24 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Recent Payments</h3>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Member</th>
                                <th>Group</th>
                                <th>Amount</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.recentPayments.map(p => (
                                <tr key={p._id}>
                                    <td>{p.user?.name || p.user?.phone || '—'}</td>
                                    <td>{p.group?.name || '—'}</td>
                                    <td style={{ fontWeight: 700 }}>₹{p.amount?.toLocaleString()}</td>
                                    <td><span className={`badge badge-${p.status}`}>{p.status}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Group Progress */}
            {data?.groupStats?.length > 0 && (
                <div style={{ marginTop: 24 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Group Progress</h3>
                    {data.groupStats.map(g => (
                        <div key={g._id} style={{
                            background: 'var(--bg-card)', border: '1px solid var(--border)',
                            borderRadius: 12, padding: 14, marginBottom: 8,
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                <span style={{ fontWeight: 600 }}>{g.name}</span>
                                <span className={`badge badge-${g.status}`}>{g.status}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
                                <span>{g.memberCount} members</span>
                                <span>Month {g.currentMonth}/{g.totalMonths}</span>
                            </div>
                            <div className="progress-bar">
                                <div className="progress-fill" style={{ width: `${g.progress?.toFixed(0) || 0}%` }} />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
