import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  IoArrowBack, IoPhonePortraitOutline, IoBusinessOutline, IoCashOutline,
  IoCheckmarkCircleOutline,
} from 'react-icons/io5';
import {
  getGroup, getMyPendingPayments, getPaymentConfig, initiatePayment, errMsg,
} from '../services/api';
import { useToast } from '../components/Toast';
import Spinner from '../components/Spinner';
import Empty from '../components/Empty';
import { inr, monthLabel } from '../utils/format';

const METHODS = [
  { key: 'upi', label: 'UPI', Icon: IoPhonePortraitOutline },
  { key: 'bank', label: 'Bank Transfer', Icon: IoBusinessOutline },
  { key: 'cash', label: 'Cash', Icon: IoCashOutline },
];

export default function PaymentPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [group, setGroup] = useState(null);
  const [due, setDue] = useState(null);
  const [config, setConfig] = useState(null);

  const [method, setMethod] = useState('upi');
  const [upiRef, setUpiRef] = useState('');
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [g, p, c] = await Promise.allSettled([
          getGroup(groupId),
          getMyPendingPayments(),
          getPaymentConfig(),
        ]);
        if (g.status === 'fulfilled') setGroup(g.value.data.group || g.value.data);
        if (p.status === 'fulfilled') {
          const list = p.value.data.data?.payments || p.value.data.payments || p.value.data || [];
          setDue(list.find((x) => (x.group?._id || x.group) === groupId) || null);
        }
        if (c.status === 'fulfilled') setConfig(c.value.data.config || c.value.data || null);
      } catch (err) {
        toast.error(errMsg(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [groupId, toast]);

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) return toast.error('Receipt must be under 4 MB');
    const reader = new FileReader();
    reader.onload = () => setReceipt(reader.result);
    reader.readAsDataURL(file);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!due) return toast.error('No payment due for this group right now');
    if (method === 'upi' && !upiRef.trim()) return toast.error('Enter the UPI reference / transaction ID');
    if ((method === 'bank' || method === 'cash') && !receipt) {
      return toast.error('Please attach a receipt for bank/cash payments');
    }
    setSubmitting(true);
    try {
      // Amount is server-authoritative — we never send it.
      await initiatePayment({
        groupId,
        month: due.month,
        paymentMethod: method,
        ...(upiRef ? { upiRef: upiRef.trim() } : {}),
        ...(receipt ? { receipt } : {}),
      });
      toast.success('Payment submitted — awaiting admin verification');
      navigate('/payments', { replace: true });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spinner full />;
  if (!group) return <Empty title="Group not found" />;

  const upiId = config?.upiId || config?.upi;
  const payeeName = config?.payeeName || config?.bankName || 'EMI Group';
  const amount = due?.amount;
  const upiLink =
    upiId && amount
      ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(group.name + ' ' + monthLabel(due.month))}`
      : null;

  return (
    <div>
      <header className="app-header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
          <IoArrowBack size={16} /> Back
        </button>
      </header>

      <div className="screen" style={{ maxWidth: 560, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24 }}>Pay EMI</h1>
        <p className="greeting mb-16">{group.name}</p>

        {!due ? (
          <Empty icon={<IoCheckmarkCircleOutline size={44} color="var(--success)" />} title="Nothing due" sub="You have no pending EMI for this group right now." />
        ) : (
          <>
            <div className="card mb-16 gradient-banner" style={{ color: '#fff', border: 'none' }}>
              <div className="row between">
                <div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.85)' }}>Amount due · {monthLabel(due.month)}</div>
                  <div className="amount" style={{ fontSize: 30, fontWeight: 800, color: '#fff' }}>{inr(amount)}</div>
                </div>
                <span className="badge" style={{ background: 'rgba(255,255,255,.25)', color: '#fff' }}>Pending</span>
              </div>
            </div>

            <form onSubmit={onSubmit}>
              <div className="field">
                <label>Payment method</label>
                <div className="row gap-8 wrap">
                  {METHODS.map(({ key, label, Icon }) => (
                    <button
                      key={key}
                      type="button"
                      className={`btn btn-sm ${method === key ? '' : 'btn-ghost'}`}
                      onClick={() => setMethod(key)}
                    >
                      <Icon size={15} /> {label}
                    </button>
                  ))}
                </div>
              </div>

              {method === 'upi' && (
                <>
                  {upiLink && (
                    <a className="btn btn-purple btn-block mb-16" href={upiLink}>Open UPI app to pay {inr(amount)}</a>
                  )}
                  {upiId && (
                    <div className="card mb-16" style={{ padding: 14 }}>
                      <div className="faint" style={{ fontSize: 12 }}>Pay to UPI ID</div>
                      <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>{upiId}</div>
                    </div>
                  )}
                  <div className="field">
                    <label>UPI reference / transaction ID</label>
                    <input className="input" value={upiRef} onChange={(e) => setUpiRef(e.target.value)} placeholder="e.g. 4324XXXXXXXX" />
                  </div>
                </>
              )}

              {(method === 'bank' || method === 'cash') && (
                <>
                  {method === 'bank' && config && (
                    <div className="card mb-16" style={{ padding: 14 }}>
                      <div className="faint mb-8" style={{ fontSize: 12 }}>Bank details</div>
                      {config.bankName && <div>{config.bankName}</div>}
                      {config.accountNumber && <div style={{ fontFamily: 'monospace' }}>A/C {config.accountNumber}</div>}
                      {config.ifsc && <div style={{ fontFamily: 'monospace' }}>IFSC {config.ifsc}</div>}
                    </div>
                  )}
                  <div className="field">
                    <label>Upload receipt</label>
                    <input className="input" type="file" accept="image/*" onChange={onFile} style={{ paddingTop: 14 }} />
                    {receipt && <img src={receipt} alt="receipt" style={{ maxWidth: '100%', borderRadius: 10, marginTop: 10 }} />}
                  </div>
                </>
              )}

              <button className="btn btn-block mt-8" disabled={submitting}>
                {submitting ? 'Submitting…' : `Submit payment of ${inr(amount)}`}
              </button>
              <p className="faint mt-16" style={{ fontSize: 12 }}>
                Your payment will be marked verified once an admin confirms it.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
