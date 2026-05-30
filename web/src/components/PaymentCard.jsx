import {
  IoTimeOutline, IoCheckmarkCircleOutline, IoShieldCheckmarkOutline,
  IoCloseCircleOutline, IoReceiptOutline,
} from 'react-icons/io5';
import { inr, monthLabel } from '../utils/format';

// Mirrors mobile PaymentCard: a colored status-icon tile, group/date/ref info,
// and amount + status label on the right.
const STATUS = {
  pending:  { fg: 'var(--st-pending-fg)',  bg: 'var(--st-pending-bg)',  Icon: IoTimeOutline,            label: 'PENDING'  },
  awaiting: { fg: 'var(--st-pending-fg)',  bg: 'var(--st-pending-bg)',  Icon: IoTimeOutline,            label: 'AWAITING' },
  paid:     { fg: 'var(--st-verified-fg)', bg: 'var(--st-verified-bg)', Icon: IoCheckmarkCircleOutline, label: 'PAID'     },
  verified: { fg: 'var(--st-verified-fg)', bg: 'var(--st-verified-bg)', Icon: IoShieldCheckmarkOutline, label: 'VERIFIED' },
  rejected: { fg: 'var(--st-rejected-fg)', bg: 'var(--st-rejected-bg)', Icon: IoCloseCircleOutline,     label: 'REJECTED' },
  failed:   { fg: 'var(--st-rejected-fg)', bg: 'var(--st-rejected-bg)', Icon: IoCloseCircleOutline,     label: 'FAILED'   },
};

export default function PaymentCard({ payment, onClick, rightSlot }) {
  const s = STATUS[payment.status] || STATUS.pending;
  const { Icon } = s;
  const groupName = payment.group?.name || payment.groupName || monthLabel(payment.month);
  const date = payment.paidAt
    ? new Date(payment.paidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : monthLabel(payment.month);

  return (
    <div
      className={`pcard ${onClick ? 'card-hover' : ''}`}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      <span className="pcard-icon" style={{ background: s.bg, color: s.fg }}>
        <Icon size={22} />
      </span>
      <div className="pcard-info">
        <div className="pcard-group">{groupName}</div>
        <div className="pcard-date">{date}</div>
        {payment.upiRef && <div className="pcard-ref">Ref: {payment.upiRef}</div>}
        {payment.receipt && (
          <div className="pcard-receipt">
            <IoReceiptOutline size={11} /> Receipt uploaded
          </div>
        )}
      </div>
      <div className="pcard-right">
        <div className="pcard-amount amount">{inr(payment.amount)}</div>
        <div className="pcard-status" style={{ color: s.fg }}>{s.label}</div>
        {rightSlot}
      </div>
    </div>
  );
}
