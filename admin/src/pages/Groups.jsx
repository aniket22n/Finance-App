import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getGroups, createGroup, deleteGroup } from '../services/api'

export default function Groups() {
    const [groups, setGroups] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [form, setForm] = useState({
        name: '', description: '', potAmount: '', emiAmount: '',
        reducedEmi: '', minMembers: '20', maxMembers: '100', totalMonths: '20',
    })
    const navigate = useNavigate()

    useEffect(() => { loadGroups() }, [])

    const loadGroups = async () => {
        try {
            const res = await getGroups()
            setGroups(res.data.groups || [])
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const handleCreate = async (e) => {
        e.preventDefault()
        try {
            await createGroup({
                name: form.name,
                description: form.description,
                potAmount: Number(form.potAmount),
                emiAmount: Number(form.emiAmount),
                reducedEmi: Number(form.reducedEmi),
                minMembers: Number(form.minMembers),
                maxMembers: Number(form.maxMembers),
                totalMonths: Number(form.totalMonths),
            })
            setShowModal(false)
            setForm({ name: '', description: '', potAmount: '', emiAmount: '', reducedEmi: '', minMembers: '20', maxMembers: '100', totalMonths: '20' })
            loadGroups()
        } catch (err) {
            alert(err.response?.data?.error || JSON.stringify(err.response?.data?.details) || 'Create failed')
        }
    }

    const handleDelete = async (id, name) => {
        if (!confirm(`Delete group "${name}"? This cannot be undone.`)) return
        try {
            await deleteGroup(id)
            loadGroups()
        } catch (err) {
            alert(err.response?.data?.error || 'Delete failed')
        }
    }

    return (
        <div>
            <div className="page-header">
                <h1>Groups</h1>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Create Group</button>
            </div>

            {loading ? (
                <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
            ) : groups.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
                    <p style={{ fontSize: 48, marginBottom: 12 }}>👥</p>
                    <p>No groups yet. Create your first group!</p>
                </div>
            ) : (
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Members</th>
                            <th>Pot Amount</th>
                            <th>EMI</th>
                            <th>Month</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {groups.map(g => (
                            <tr key={g._id}>
                                <td>
                                    <span style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--accent)' }}
                                        onClick={() => navigate(`/groups/${g._id}`)}>
                                        {g.name}
                                    </span>
                                </td>
                                <td>{g.members?.length || 0}/{g.maxMembers}</td>
                                <td style={{ fontWeight: 600 }}>₹{g.potAmount?.toLocaleString()}</td>
                                <td>₹{g.emiAmount?.toLocaleString()}</td>
                                <td>{g.currentMonth}/{g.totalMonths}</td>
                                <td><span className={`badge badge-${g.status}`}>{g.status}</span></td>
                                <td>
                                    <button className="btn btn-outline btn-sm" style={{ marginRight: 6 }}
                                        onClick={() => navigate(`/groups/${g._id}`)}>
                                        View
                                    </button>
                                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(g._id, g.name)}>
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {/* Create Group Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Create New Group</h3>
                        <form onSubmit={handleCreate}>
                            <div className="form-group">
                                <label>Group Name *</label>
                                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label>Description</label>
                                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div className="form-group">
                                    <label>Pot Amount (₹) *</label>
                                    <input type="number" value={form.potAmount} onChange={e => setForm({ ...form, potAmount: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label>EMI Amount (₹) *</label>
                                    <input type="number" value={form.emiAmount} onChange={e => setForm({ ...form, emiAmount: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label>Reduced EMI (₹) *</label>
                                    <input type="number" value={form.reducedEmi} onChange={e => setForm({ ...form, reducedEmi: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label>Total Months *</label>
                                    <input type="number" min="20" max="100" value={form.totalMonths} onChange={e => setForm({ ...form, totalMonths: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label>Min Members</label>
                                    <input type="number" min="20" value={form.minMembers} onChange={e => setForm({ ...form, minMembers: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Max Members</label>
                                    <input type="number" max="100" value={form.maxMembers} onChange={e => setForm({ ...form, maxMembers: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-actions">
                                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Create Group</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
