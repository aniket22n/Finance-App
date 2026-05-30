import {
  IoTimeOutline, IoCheckmarkCircleOutline, IoShieldCheckmarkOutline,
  IoCloseCircleOutline, IoPerson, IoChevronForward,
} from 'react-icons/io5';

// Mirrors mobile MemberCard: current POT holder gets a primary gradient card;
// past winners + regular members get a plain card. Right side shows payment
// status + EMI; a rank circle shows the won-month or a person glyph.
const PAYMENT_STATUS = {
  pending:  { Icon: IoTimeOutline,             label: 'Pending'  },
  paid:     { Icon: IoCheckmarkCircleOutline,  label: 'Paid'     },
  verified: { Icon: IoShieldCheckmarkOutline,  label: 'Verified' },
  failed:   { Icon: IoCloseCircleOutline,      label: 'Failed'   },
};

export default function MemberCard({ member, isWinner, isPastWinner, winnerMonth, paymentStatus, emiAmount, onClick }) {
  const ps = PAYMENT_STATUS[paymentStatus] || PAYMENT_STATUS.pending;
  const { Icon } = ps;
  const statusColor = paymentStatus === 'verified' || paymentStatus === 'paid'
    ? 'var(--success)' : paymentStatus === 'failed' ? 'var(--error)' : 'var(--warning)';
  const clickable = !!onClick;
  const Tag = clickable ? 'button' : 'div';

  const inner = (whiteText) => (
    <>
      <span className="mc-rank" style={isWinner ? { background: 'rgba(0,0,0,0.25)', borderColor: 'rgba(0,0,0,0.2)' } : undefined}>
        {isWinner || isPastWinner
          ? <span style={{ fontSize: 15, fontWeight: 700, color: whiteText ? '#fff' : 'var(--primary)' }}>{winnerMonth}</span>
          : <IoPerson size={16} color="var(--text-secondary)" />}
      </span>
      <span className="mc-body">
        <span className="mc-name" style={whiteText ? { color: '#fff' } : undefined}>{member.name || member.phone}</span>
        {member.phone && member.name && (
          <span className="mc-sub" style={{ color: whiteText ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)' }}>{member.phone}</span>
        )}
        {(isWinner || isPastWinner) && (
          <span className="mc-sub" style={{ fontWeight: 700, color: whiteText ? '#fff' : 'var(--text-secondary)' }}>POT - {winnerMonth}</span>
        )}
      </span>
      <span className="mc-right">
        <Icon size={15} color={statusColor} />
        <span style={{ fontSize: 10, fontWeight: 500, color: statusColor }}>{ps.label}</span>
        {emiAmount ? <span style={{ fontSize: 12, fontWeight: 700, color: whiteText ? '#fff' : 'var(--text)' }}>₹{Number(emiAmount).toLocaleString('en-IN')}</span> : null}
      </span>
      {clickable && <IoChevronForward size={16} color={whiteText ? 'rgba(255,255,255,0.5)' : 'var(--text-tertiary)'} style={{ marginLeft: 4 }} />}
    </>
  );

  if (isWinner) {
    return (
      <Tag className={`mc-card mc-winner ${clickable ? 'mc-click' : ''}`} onClick={onClick}>
        {inner(true)}
      </Tag>
    );
  }
  return (
    <Tag className={`mc-card mc-plain ${clickable ? 'mc-click' : ''}`} onClick={onClick}>
      {inner(false)}
    </Tag>
  );
}
