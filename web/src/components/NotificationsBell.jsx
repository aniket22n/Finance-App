import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IoNotifications, IoNotificationsOutline, IoNotificationsOffOutline,
  IoCheckmarkDone, IoClose, IoTrashOutline, IoPersonAdd, IoShieldCheckmark,
  IoWallet, IoCheckmarkCircle, IoCloseCircle,
} from 'react-icons/io5';
import {
  getNotifications, getUnreadCount, markNotificationRead,
  markAllNotificationsRead, deleteNotification,
} from '../services/api';
import './notifications.css';

// Type → icon + colour/tint tokens (mirrors mobile TYPE_META colorKey + 'Light').
const TYPE_META = {
  account_request:   { Icon: IoPersonAdd,       color: 'var(--warning)', tint: 'var(--warning-light)' },
  account_approved:  { Icon: IoShieldCheckmark, color: 'var(--success)', tint: 'var(--success-light)' },
  payment_submitted: { Icon: IoWallet,          color: 'var(--info)',    tint: 'var(--info-light)' },
  payment_verified:  { Icon: IoCheckmarkCircle, color: 'var(--success)', tint: 'var(--success-light)' },
  payment_rejected:  { Icon: IoCloseCircle,     color: 'var(--error)',   tint: 'var(--error-light)' },
};

function routeFor(n) {
  switch (n.type) {
    case 'account_request': return '/admin/requests';
    case 'payment_submitted':
    case 'payment_verified':
    case 'payment_rejected': return '/payments';
    default: return null;
  }
}

function timeAgo(d) {
  if (!d) return '';
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

// Bucket into Today / Yesterday / Earlier (mirrors mobile groupSections).
function groupSections(items) {
  const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
  const today = startOfDay(new Date());
  const yesterday = today - 86400000;
  const buckets = { today: [], yesterday: [], earlier: [] };
  for (const n of items) {
    const t = startOfDay(new Date(n.createdAt));
    if (t === today) buckets.today.push(n);
    else if (t === yesterday) buckets.yesterday.push(n);
    else buckets.earlier.push(n);
  }
  const sections = [];
  if (buckets.today.length) sections.push({ title: 'Today', data: buckets.today });
  if (buckets.yesterday.length) sections.push({ title: 'Yesterday', data: buckets.yesterday });
  if (buckets.earlier.length) sections.push({ title: 'Earlier', data: buckets.earlier });
  return sections;
}

export default function NotificationsBell() {
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const refreshCount = useCallback(async () => {
    try { const r = await getUnreadCount(); setUnread(r.data?.count || 0); } catch { /* silent */ }
  }, []);
  useEffect(() => { refreshCount(); }, [refreshCount]);

  const loadList = async () => {
    setLoading(true);
    try { const r = await getNotifications(); setItems(r.data?.notifications || []); }
    catch { setItems([]); }
    finally { setLoading(false); }
  };

  const openPanel = () => { setOpen(true); loadList(); };
  const closePanel = () => { setOpen(false); refreshCount(); };

  const markRead = async (item) => {
    if (item.read) return;
    setItems((p) => p.map((n) => (n._id === item._id ? { ...n, read: true } : n)));
    setUnread((c) => Math.max(0, c - 1));
    try { await markNotificationRead(item._id); } catch { /* silent */ }
  };

  const handlePress = async (item) => {
    await markRead(item);
    const target = routeFor(item);
    if (target) { closePanel(); navigate(target); }
  };

  const handleDismiss = async (e, item) => {
    e.stopPropagation();
    setItems((p) => p.filter((n) => n._id !== item._id));
    if (!item.read) setUnread((c) => Math.max(0, c - 1));
    try { await deleteNotification(item._id); } catch { /* silent */ }
  };

  const markAll = async () => {
    if (unread === 0) return;
    setItems((p) => p.map((n) => ({ ...n, read: true })));
    setUnread(0);
    try { await markAllNotificationsRead(); } catch { /* silent */ }
  };

  const sections = groupSections(items);

  return (
    <div className="bell">
      <button className="bell-btn" onClick={open ? closePanel : openPanel} aria-label="Notifications">
        {unread > 0 ? <IoNotifications size={22} /> : <IoNotificationsOutline size={22} />}
        {unread > 0 && <span className="bell-badge">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <>
          <div className="bell-backdrop" onClick={closePanel} />
          <div className="bell-panel">
            <div className="bell-drag" />
            <div className="bell-head">
              <div className="row gap-10">
                <span className="bell-head-icon"><IoNotifications size={14} /></span>
                <div>
                  <div className="bell-title">Notifications</div>
                  <div className="bell-sub">{unread > 0 ? `${unread} new` : "You're all caught up"}</div>
                </div>
              </div>
              <div className="row gap-8">
                {unread > 0 && (
                  <button className="bell-markall" onClick={markAll}><IoCheckmarkDone size={13} /> Mark all</button>
                )}
                <button className="bell-close" onClick={closePanel}><IoClose size={16} /></button>
              </div>
            </div>

            <div className="bell-list">
              {loading ? (
                <div className="center" style={{ padding: 40 }}><span className="spinner" /></div>
              ) : items.length === 0 ? (
                <div className="bell-empty">
                  <span className="bell-empty-icon"><IoNotificationsOffOutline size={28} /></span>
                  <div style={{ fontWeight: 700 }}>You're all caught up</div>
                  <div className="muted" style={{ fontSize: 12 }}>New activity will show up here.</div>
                </div>
              ) : (
                sections.map((section) => (
                  <div key={section.title}>
                    <div className="bell-section">{section.title}</div>
                    {section.data.map((item) => {
                      const meta = TYPE_META[item.type] || { Icon: IoNotifications, color: 'var(--primary)', tint: 'var(--primary-light)' };
                      const { Icon } = meta;
                      return (
                        <div key={item._id} className={`bell-item ${item.read ? '' : 'unread'}`} onClick={() => handlePress(item)}>
                          <span className="bell-item-icon" style={{ background: meta.tint, borderColor: meta.color, color: meta.color }}>
                            <Icon size={16} />
                          </span>
                          <div className="bell-item-main">
                            <div className="row between gap-8">
                              <span className="bell-item-title">{item.title}</span>
                              <span className="bell-item-time">{timeAgo(item.createdAt)}</span>
                            </div>
                            {item.body && <div className="bell-item-body">{item.body}</div>}
                          </div>
                          {!item.read && <span className="bell-dot" />}
                          <button className="bell-item-del" onClick={(e) => handleDismiss(e, item)} aria-label="Dismiss">
                            <IoTrashOutline size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
