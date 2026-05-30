import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import { getRevenueAnalytics, getGroupHealth, errMsg } from '../../services/api';
import { useToast } from '../../components/Toast';
import Spinner from '../../components/Spinner';
import Empty from '../../components/Empty';
import { inr } from '../../utils/format';

const COLORS = ['#FF6E6A', '#10B981', '#8B5CF6', '#F0A500', '#3B82F6'];

// Reads a CSS custom property so the chart tracks the active light/dark theme.
const cssVar = (name, fallback) => {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
};

export default function AdminAnalyticsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  // Force a re-read of theme CSS vars whenever the light/dark (or primary) attribute flips.
  const [, bumpTheme] = useState(0);
  useEffect(() => {
    const mo = new MutationObserver(() => bumpTheme((n) => n + 1));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-primary'] });
    return () => mo.disconnect();
  }, []);
  const [revenue, setRevenue] = useState([]);
  const [health, setHealth] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [rev, hp] = await Promise.allSettled([getRevenueAnalytics(), getGroupHealth()]);
        if (rev.status === 'fulfilled') {
          const d = rev.value.data;
          const arr = d.revenue || d.monthly || d.data || (Array.isArray(d) ? d : []);
          setRevenue(
            arr.map((x) => ({
              label: x.label || x.month || x.name || '',
              value: Number(x.collected ?? x.amount ?? x.value ?? x.revenue ?? 0),
            }))
          );
        }
        if (hp.status === 'fulfilled') {
          const d = hp.value.data;
          setHealth(d.groups || d.health || d.data || (Array.isArray(d) ? d : []));
        }
      } catch (err) {
        toast.error(errMsg(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  if (loading) return <Spinner full />;

  const gridColor = cssVar('--border', '#E5E7EB');
  const axisColor = cssVar('--text-secondary', '#6B7280');
  const surface = cssVar('--background', '#fff');
  const textColor = cssVar('--text', '#2C2E39');

  return (
    <div>
      <header className="app-header"><div><h1>Analytics</h1><div className="greeting">Revenue trends and group health</div></div></header>

      <div className="screen">
      <div className="card mb-16">
        <h2 className="section-title">Revenue collected</h2>
        {revenue.length === 0 ? (
          <Empty title="No revenue data yet" />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenue}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="label" stroke={axisColor} fontSize={12} />
              <YAxis stroke={axisColor} fontSize={12} tickFormatter={(v) => inr(v)} width={70} />
              <Tooltip
                formatter={(v) => inr(v)}
                contentStyle={{ background: surface, border: `1px solid ${gridColor}`, borderRadius: 10, color: textColor }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {revenue.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card">
        <h2 className="section-title">Group health</h2>
        {health.length === 0 ? (
          <Empty title="No group health data" />
        ) : (
          <div className="table-wrap" style={{ border: 'none' }}>
            <table className="tbl">
              <thead>
                <tr><th>Group</th><th>Members</th><th>Collected</th><th>Pending</th><th>Collection rate</th></tr>
              </thead>
              <tbody>
                {health.map((g, i) => {
                  const rate = g.collectionRate ?? g.rate ?? null;
                  return (
                    <tr key={g._id || g.groupId || i}>
                      <td>{g.name || g.groupName || '—'}</td>
                      <td>{g.memberCount ?? g.members ?? '—'}</td>
                      <td className="amount">{inr(g.collected ?? g.totalCollected ?? 0)}</td>
                      <td>{g.pending ?? g.pendingCount ?? 0}</td>
                      <td>
                        {rate != null ? (
                          <span className={`badge ${rate >= 80 ? 'badge-green' : rate >= 50 ? 'badge-amber' : 'badge-red'}`}>
                            {Math.round(rate)}%
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
