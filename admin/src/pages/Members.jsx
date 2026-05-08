import { useState, useEffect } from 'react'
import { getUsers, updateUserRole } from '../services/api'

export default function Members() {
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)

    useEffect(() => { loadUsers() }, [search, page])

    const loadUsers = async () => {
        try {
            const res = await getUsers({ search, page, limit: 30 })
            setUsers(res.data.users || [])
            setTotal(res.data.total || 0)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const handleRoleChange = async (userId, newRole) => {
        if (!confirm(`Change this user's role to ${newRole}?`)) return
        try {
            await updateUserRole(userId, newRole)
            loadUsers()
        } catch (err) {
            alert(err.response?.data?.error || 'Failed')
        }
    }

    return (
        <div>
            <div className="page-header">
                <h1>Members ({total})</h1>
            </div>

            <div style={{ marginBottom: 20 }}>
                <input
                    type="text"
                    placeholder="🔍 Search by name, phone, or email..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                    style={{ width: '100%', maxWidth: 400, padding: '12px 16px' }}
                />
            </div>

            {loading ? (
                <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
            ) : (
                <>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Phone</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Joined</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u._id}>
                                    <td style={{ fontWeight: 600 }}>{u.name || '—'}</td>
                                    <td>{u.phone}</td>
                                    <td>{u.email || '—'}</td>
                                    <td>
                                        <span className={`badge ${u.role === 'admin' ? 'badge-active' : 'badge-pending'}`}>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                                        {new Date(u.createdAt).toLocaleDateString('en-IN')}
                                    </td>
                                    <td>
                                        <select
                                            value={u.role}
                                            onChange={(e) => handleRoleChange(u._id, e.target.value)}
                                            style={{ padding: '4px 8px', fontSize: 12 }}
                                        >
                                            <option value="member">Member</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    </td>
                                </tr>
                            ))}
                            {users.length === 0 && (
                                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No users found</td></tr>
                            )}
                        </tbody>
                    </table>

                    {total > 30 && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                            <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                                ← Prev
                            </button>
                            <span style={{ color: 'var(--text-secondary)', padding: '6px 12px', fontSize: 13 }}>
                                Page {page}
                            </span>
                            <button className="btn btn-outline btn-sm" disabled={page * 30 >= total} onClick={() => setPage(p => p + 1)}>
                                Next →
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
