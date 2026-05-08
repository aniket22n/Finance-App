import { useState, useEffect } from 'react'
import { getPendingPayments, verifyPayment } from '../services/api'

export default function Payments() {
    const [payments, setPayments] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => { loadPayments() }, [])

    const loadPayments = async () => {
        try {
            const res = await getPendingPayments()
            setPayments(res.data.payments || [])
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const handleVerify = async (paymentId, status) => {
        const notes = status === 'failed' ? prompt('Rejection reason (optional):') || '' : ''
        try {
            await verifyPayment(paymentId, status, notes)
            loadPayments()
        } catch (err) {
            alert(err.response?.data?.error || 'Verification failed')
        }
    }

    return (
        <div>
            <div className="page-header">
                <h1>Payment Verification</h1>
                <button className="btn btn-outline" onClick={loadPayments}>🔄 Refresh</button>
            </div>

            {loading ? (
                <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
            ) : payments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
                    <p style={{ fontSize: 48, marginBottom: 12 }}>✅</p>
                    <p>No pending payments to verify!</p>
                </div>
            ) : (
                <>
                    <div style={{
                        background: 'rgba(240,165,0,0.1)', border: '1px solid var(--warning)',
                        borderRadius: 12, padding: 14, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10,
                    }}>
                        <span style={{ fontSize: 20 }}>⚠️</span>
                        <span style={{ color: 'var(--warning)', fontSize: 14, fontWeight: 600 }}>
                            {payments.length} payment(s) awaiting verification
                        </span>
                    </div>

                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Member</th>
                                <th>Group</th>
                                <th>Month</th>
                                <th>Amount</th>
                                <th>UPI Ref</th>
                                <th>Paid At</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payments.map(p => (
                                <tr key={p._id}>
                                    <td style={{ fontWeight: 600 }}>{p.user?.name || p.user?.phone || '—'}</td>
                                    <td>{p.group?.name || '—'}</td>
                                    <td>Month {p.month}</td>
                                    <td style={{ fontWeight: 700 }}>₹{p.amount?.toLocaleString()}</td>
                                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.upiRef || '—'}</td>
                                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                        {p.paidAt ? new Date(p.paidAt).toLocaleString('en-IN') : '—'}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button className="btn btn-success btn-sm" onClick={() => handleVerify(p._id, 'verified')}>
                                                ✓ Verify
                                            </button>
                                            <button className="btn btn-danger btn-sm" onClick={() => handleVerify(p._id, 'failed')}>
                                                ✗ Reject
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            )}
        </div>
    )
}
