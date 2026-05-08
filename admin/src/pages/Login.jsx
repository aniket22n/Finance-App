import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sendOtp, adminLogin } from '../services/api'

export default function Login() {
    const [phone, setPhone] = useState('')
    const [otp, setOtp] = useState('')
    const [step, setStep] = useState('phone')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const navigate = useNavigate()

    const handleSendOtp = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')
        try {
            await sendOtp(phone)
            setStep('otp')
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to send OTP')
        } finally {
            setLoading(false)
        }
    }

    const handleVerify = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')
        try {
            const res = await adminLogin(phone, otp)
            if (res.data.user.role !== 'admin') {
                setError('Admin access required. Contact your administrator.')
                return
            }
            localStorage.setItem('adminToken', res.data.token)
            navigate('/')
        } catch (err) {
            setError(err.response?.data?.error || 'Invalid OTP')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        }}>
            <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 20, padding: 40, width: '100%', maxWidth: 420,
                boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            }}>
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{
                        width: 72, height: 72, borderRadius: 20, background: 'var(--accent)',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 36, marginBottom: 16,
                    }}>💰</div>
                    <h1 style={{ fontSize: 24, fontWeight: 800 }}>EMI Admin Panel</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 6 }}>
                        Manage your groups & members
                    </p>
                </div>

                {error && (
                    <div style={{
                        background: 'rgba(225,112,85,0.15)', border: '1px solid var(--error)',
                        borderRadius: 8, padding: '10px 14px', marginBottom: 16,
                        color: 'var(--error)', fontSize: 13,
                    }}>{error}</div>
                )}

                {step === 'phone' ? (
                    <form onSubmit={handleSendOtp}>
                        <div className="form-group" style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                                Admin Phone Number
                            </label>
                            <input
                                type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                                placeholder="Enter 10-digit number" maxLength={10}
                                style={{ width: '100%', padding: '12px 16px', fontSize: 16 }}
                                required
                            />
                        </div>
                        <button
                            type="submit" className="btn btn-primary"
                            disabled={loading || phone.length < 10}
                            style={{ width: '100%', padding: '14px', fontSize: 15, justifyContent: 'center' }}
                        >
                            {loading ? 'Sending...' : 'Send OTP'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleVerify}>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
                            OTP sent to +91 {phone}
                        </p>
                        <div style={{ marginBottom: 16 }}>
                            <input
                                type="text" value={otp} onChange={(e) => setOtp(e.target.value)}
                                placeholder="Enter 4-digit OTP" maxLength={4}
                                style={{ width: '100%', padding: '14px', fontSize: 22, textAlign: 'center', letterSpacing: 8 }}
                                required
                            />
                        </div>
                        <button
                            type="submit" className="btn btn-primary"
                            disabled={loading || otp.length < 4}
                            style={{ width: '100%', padding: '14px', fontSize: 15, justifyContent: 'center', marginBottom: 12 }}
                        >
                            {loading ? 'Verifying...' : 'Login'}
                        </button>
                        <button
                            type="button" className="btn btn-outline"
                            onClick={() => { setStep('phone'); setOtp(''); setError('') }}
                            style={{ width: '100%', justifyContent: 'center' }}
                        >
                            ← Change number
                        </button>
                    </form>
                )}

                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 11, marginTop: 24 }}>
                    Dev mode: OTP is 1234
                </p>
            </div>
        </div>
    )
}
