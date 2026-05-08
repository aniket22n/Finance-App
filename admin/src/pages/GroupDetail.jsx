import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getGroup, updateGroup, addMember, removeMember, getUsers, createEmiCycle, getEmiCycles, saveMonthlyConfig } from '../services/api'

export default function GroupDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [group, setGroup] = useState(null)
    const [summary, setSummary] = useState(null)
    const [cycles, setCycles] = useState([])
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)
    const [showAddMember, setShowAddMember] = useState(false)
    const [showConfig, setShowConfig] = useState(false)
    const [showCycle, setShowCycle] = useState(false)
    const [showMonthlyConfig, setShowMonthlyConfig] = useState(false)
    const [selectedUser, setSelectedUser] = useState('')
    const [selectedWinner, setSelectedWinner] = useState('')
    const [config, setConfig] = useState({})
    const [monthlyRows, setMonthlyRows] = useState([])
    const [savingMonthly, setSavingMonthly] = useState(false)

    useEffect(() => { loadData() }, [id])

    const loadData = async () => {
        try {
            const [groupRes, cyclesRes, usersRes] = await Promise.all([
                getGroup(id),
                getEmiCycles(id).catch(() => ({ data: { cycles: [] } })),
                getUsers({ limit: 200 }),
            ])
            const g = groupRes.data.group
            setGroup(g)
            setSummary(groupRes.data.summary)
            setCycles(cyclesRes.data.cycles || [])
            setUsers(usersRes.data.users || [])
            setConfig({
                name: g.name,
                potAmount: g.potAmount,
                emiAmount: g.emiAmount,
                reducedEmi: g.reducedEmi,
                status: g.status,
                dueDay: g.dueDay,
                reminderDaysBefore: g.reminderDaysBefore,
            })
            // Build monthly config rows
            buildMonthlyRows(g)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const buildMonthlyRows = (g) => {
        const rows = []
        for (let m = 1; m <= g.totalMonths; m++) {
            const custom = g.monthlyConfig?.find(c => c.month === m)
            rows.push({
                month: m,
                potAmount: custom?.potAmount ?? g.potAmount,
                emiAmount: custom?.emiAmount ?? g.emiAmount,
                reducedEmi: custom?.reducedEmi ?? g.reducedEmi,
                isCustom: !!custom,
            })
        }
        setMonthlyRows(rows)
    }

    const handleMonthlyChange = (index, field, value) => {
        const updated = [...monthlyRows]
        updated[index] = { ...updated[index], [field]: Number(value), isCustom: true }
        setMonthlyRows(updated)
    }

    const handleApplyDefaultToAll = () => {
        if (!confirm('Reset all months to the default values?')) return
        const rows = monthlyRows.map(r => ({
            ...r,
            potAmount: group.potAmount,
            emiAmount: group.emiAmount,
            reducedEmi: group.reducedEmi,
            isCustom: false,
        }))
        setMonthlyRows(rows)
    }

    const handleSaveMonthlyConfig = async () => {
        setSavingMonthly(true)
        try {
            // Only save months that differ from default
            const customMonths = monthlyRows.filter(r =>
                r.potAmount !== group.potAmount ||
                r.emiAmount !== group.emiAmount ||
                r.reducedEmi !== group.reducedEmi
            ).map(r => ({
                month: r.month,
                potAmount: r.potAmount,
                emiAmount: r.emiAmount,
                reducedEmi: r.reducedEmi,
            }))
            await saveMonthlyConfig(id, customMonths)
            alert('Monthly configuration saved!')
            loadData()
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to save')
        } finally {
            setSavingMonthly(false)
        }
    }

    const handleAddMember = async () => {
        if (!selectedUser) return
        try {
            await addMember(id, selectedUser)
            setShowAddMember(false)
            setSelectedUser('')
            loadData()
        } catch (err) {
            alert(err.response?.data?.error || 'Failed')
        }
    }

    const handleRemoveMember = async (userId, name) => {
        if (!confirm(`Remove ${name} from this group?`)) return
        try {
            await removeMember(id, userId)
            loadData()
        } catch (err) {
            alert(err.response?.data?.error || 'Failed')
        }
    }

    const handleUpdateConfig = async (e) => {
        e.preventDefault()
        try {
            await updateGroup(id, {
                ...config,
                potAmount: Number(config.potAmount),
                emiAmount: Number(config.emiAmount),
                reducedEmi: Number(config.reducedEmi),
                dueDay: Number(config.dueDay),
                reminderDaysBefore: Number(config.reminderDaysBefore),
            })
            setShowConfig(false)
            loadData()
        } catch (err) {
            alert(err.response?.data?.error || 'Update failed')
        }
    }

    const handleCreateCycle = async () => {
        if (!selectedWinner) return
        try {
            await createEmiCycle(id, selectedWinner)
            setShowCycle(false)
            setSelectedWinner('')
            loadData()
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to create cycle')
        }
    }

    if (loading) return <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
    if (!group) return <p style={{ color: 'var(--error)' }}>Group not found</p>

    const memberIds = group.members?.map(m => m._id) || []
    const nonMembers = users.filter(u => !memberIds.includes(u._id))
    const progress = group.totalMonths > 0 ? ((group.currentMonth / group.totalMonths) * 100).toFixed(0) : 0
    const customCount = monthlyRows.filter(r => r.isCustom).length

    return (
        <div>
            {/* Header */}
            <div className="page-header">
                <div>
                    <button className="btn btn-outline btn-sm" onClick={() => navigate('/groups')} style={{ marginBottom: 8 }}>
                        ← Back to Groups
                    </button>
                    <h1>{group.name}</h1>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-outline" onClick={() => setShowConfig(true)}>⚙️ Config</button>
                    <button className="btn btn-outline" onClick={() => setShowMonthlyConfig(!showMonthlyConfig)}>
                        📅 Monthly Config {customCount > 0 && <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, marginLeft: 4 }}>{customCount}</span>}
                    </button>
                    <button className="btn btn-primary" onClick={() => setShowCycle(true)}>🎯 New Cycle</button>
                </div>
            </div>

            {/* Stats */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-value">{group.members?.length || 0}/{group.maxMembers}</div>
                    <div className="stat-label">Members</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">₹{group.potAmount?.toLocaleString()}</div>
                    <div className="stat-label">Default Pot</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">₹{group.emiAmount?.toLocaleString()}</div>
                    <div className="stat-label">Default EMI</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{progress}%</div>
                    <div className="stat-label">Month {group.currentMonth}/{group.totalMonths}</div>
                    <div className="progress-bar" style={{ marginTop: 8 }}>
                        <div className="progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                </div>
            </div>

            {/* Monthly Config Panel */}
            {showMonthlyConfig && (
                <div style={{
                    background: 'var(--card-bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: 20,
                    marginBottom: 24,
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <div>
                            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>📅 Monthly Configuration</h3>
                            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                                Customize POT, EMI, and Reduced amounts for each month. Highlighted rows differ from defaults.
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-outline btn-sm" onClick={handleApplyDefaultToAll}>Reset All</button>
                            <button className="btn btn-primary btn-sm" onClick={handleSaveMonthlyConfig} disabled={savingMonthly}>
                                {savingMonthly ? 'Saving...' : '💾 Save'}
                            </button>
                        </div>
                    </div>
                    <div style={{ maxHeight: 420, overflowY: 'auto', borderRadius: 8 }}>
                        <table className="data-table" style={{ margin: 0 }}>
                            <thead>
                                <tr>
                                    <th style={{ width: 70 }}>Month</th>
                                    <th>POT Amount (₹)</th>
                                    <th>EMI Amount (₹)</th>
                                    <th>Reduced EMI (₹)</th>
                                    <th style={{ width: 80 }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {monthlyRows.map((row, i) => (
                                    <tr key={row.month} style={{
                                        background: row.isCustom ? 'rgba(233, 69, 96, 0.08)' : 'transparent',
                                        borderLeft: row.isCustom ? '3px solid var(--accent)' : '3px solid transparent',
                                    }}>
                                        <td style={{ fontWeight: 700, fontSize: 14 }}>
                                            {row.month}
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                value={row.potAmount}
                                                onChange={e => handleMonthlyChange(i, 'potAmount', e.target.value)}
                                                style={{ width: '100%', padding: '6px 8px', fontSize: 13 }}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                value={row.emiAmount}
                                                onChange={e => handleMonthlyChange(i, 'emiAmount', e.target.value)}
                                                style={{ width: '100%', padding: '6px 8px', fontSize: 13 }}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                value={row.reducedEmi}
                                                onChange={e => handleMonthlyChange(i, 'reducedEmi', e.target.value)}
                                                style={{ width: '100%', padding: '6px 8px', fontSize: 13 }}
                                            />
                                        </td>
                                        <td>
                                            {row.isCustom
                                                ? <span className="badge badge-active" style={{ fontSize: 10 }}>Custom</span>
                                                : <span className="badge badge-pending" style={{ fontSize: 10 }}>Default</span>
                                            }
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Members */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>Members ({group.members?.length || 0})</h3>
                <button className="btn btn-primary btn-sm" onClick={() => setShowAddMember(true)}>+ Add Member</button>
            </div>
            <table className="data-table" style={{ marginBottom: 24 }}>
                <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Actions</th></tr></thead>
                <tbody>
                    {group.members?.map(m => (
                        <tr key={m._id}>
                            <td style={{ fontWeight: 600 }}>{m.name || '—'}</td>
                            <td>{m.phone}</td>
                            <td>{m.email || '—'}</td>
                            <td>
                                <button className="btn btn-danger btn-sm" onClick={() => handleRemoveMember(m._id, m.name || m.phone)}>
                                    Remove
                                </button>
                            </td>
                        </tr>
                    ))}
                    {(!group.members || group.members.length === 0) && (
                        <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No members yet</td></tr>
                    )}
                </tbody>
            </table>

            {/* EMI Cycles */}
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>EMI Cycles</h3>
            {cycles.length > 0 ? (
                <table className="data-table">
                    <thead><tr><th>Month</th><th>Winner</th><th>POT</th><th>EMI</th><th>Reduced</th><th>Status</th></tr></thead>
                    <tbody>
                        {cycles.map(c => (
                            <tr key={c._id}>
                                <td style={{ fontWeight: 700 }}>Month {c.month}</td>
                                <td>{c.winner?.name || c.winner?.phone || '—'}</td>
                                <td>₹{c.potAmount?.toLocaleString()}</td>
                                <td>₹{c.emiAmount?.toLocaleString()}</td>
                                <td>₹{c.reducedEmi?.toLocaleString()}</td>
                                <td><span className={`badge badge-${c.status}`}>{c.status}</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <p style={{ color: 'var(--text-secondary)' }}>No cycles created yet</p>
            )}

            {/* Add Member Modal */}
            {showAddMember && (
                <div className="modal-overlay" onClick={() => setShowAddMember(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h3>Add Member</h3>
                        <div className="form-group">
                            <label>Select User</label>
                            <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)} style={{ width: '100%' }}>
                                <option value="">Choose a user...</option>
                                {nonMembers.map(u => (
                                    <option key={u._id} value={u._id}>{u.name || u.phone} ({u.phone})</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-actions">
                            <button className="btn btn-outline" onClick={() => setShowAddMember(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleAddMember} disabled={!selectedUser}>Add</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Config Modal */}
            {showConfig && (
                <div className="modal-overlay" onClick={() => setShowConfig(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h3>Group Configuration</h3>
                        <form onSubmit={handleUpdateConfig}>
                            <div className="form-group">
                                <label>Name</label>
                                <input value={config.name} onChange={e => setConfig({ ...config, name: e.target.value })} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div className="form-group">
                                    <label>Default Pot Amount (₹)</label>
                                    <input type="number" value={config.potAmount} onChange={e => setConfig({ ...config, potAmount: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Default EMI Amount (₹)</label>
                                    <input type="number" value={config.emiAmount} onChange={e => setConfig({ ...config, emiAmount: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Default Reduced EMI (₹)</label>
                                    <input type="number" value={config.reducedEmi} onChange={e => setConfig({ ...config, reducedEmi: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Due Date (1-31)</label>
                                    <input type="number" min="1" max="31" value={config.dueDay} onChange={e => setConfig({ ...config, dueDay: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Reminder Days Before</label>
                                    <input type="number" min="0" max="30" value={config.reminderDaysBefore} onChange={e => setConfig({ ...config, reminderDaysBefore: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Status</label>
                                    <select value={config.status} onChange={e => setConfig({ ...config, status: e.target.value })}>
                                        <option value="pending">Pending</option>
                                        <option value="active">Active</option>
                                        <option value="paused">Paused</option>
                                        <option value="completed">Completed</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-actions">
                                <button type="button" className="btn btn-outline" onClick={() => setShowConfig(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* New Cycle Modal */}
            {showCycle && (
                <div className="modal-overlay" onClick={() => setShowCycle(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h3>Create EMI Cycle (Month {(group.currentMonth || 0) + 1})</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
                            Select the pot winner for this month. They will pay reduced EMI (₹{group.reducedEmi?.toLocaleString()}).
                        </p>
                        <div className="form-group">
                            <label>Pot Winner</label>
                            <select value={selectedWinner} onChange={e => setSelectedWinner(e.target.value)} style={{ width: '100%' }}>
                                <option value="">Select winner...</option>
                                {group.members?.filter(m => !cycles.map(c => c.winner?._id || c.winner).includes(m._id)).map(m => (
                                    <option key={m._id} value={m._id}>{m.name || m.phone}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-actions">
                            <button className="btn btn-outline" onClick={() => setShowCycle(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleCreateCycle} disabled={!selectedWinner}>
                                🎯 Create Cycle
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
