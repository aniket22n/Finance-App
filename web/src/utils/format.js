// Indian rupee formatting + shared display helpers.

export const inr = (n) => {
  const num = Number(n || 0);
  return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

export const initials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || '?';

export const fmtDate = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date)) return '—';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const monthLabel = (m) => (m ? `Month ${m}` : '—');

// Payment status -> badge class + label
export const paymentBadge = (status) => {
  const map = {
    verified: ['badge-green', 'Verified'],
    paid: ['badge-purple', 'Paid'],
    awaiting: ['badge-amber', 'Awaiting'],
    pending: ['badge-amber', 'Pending'],
    rejected: ['badge-red', 'Rejected'],
    failed: ['badge-red', 'Failed'],
    overdue: ['badge-red', 'Overdue'],
  };
  return map[status] || ['badge-gray', status || 'Unknown'];
};

export const groupBadge = (status) => {
  const map = {
    active: ['badge-green', 'Active'],
    completed: ['badge-purple', 'Completed'],
    paused: ['badge-amber', 'Paused'],
    pending: ['badge-gray', 'Pending'],
    draft: ['badge-gray', 'Draft'],
  };
  return map[status] || ['badge-gray', status || '—'];
};

// Avatar colour derived deterministically from a name/id.
const PALETTE = ['#e94560', '#00b894', '#6c5ce7', '#f0a500', '#0984e3', '#e17055'];
export const colorFor = (key = '') => {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = key.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
};
