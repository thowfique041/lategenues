import { Bell, Check, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export function NotificationBell() {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const load = () => api('/notifications').then(data => setItems(Array.isArray(data) ? data : [])).catch(e => setError(e.message));
  useEffect(() => { load(); const timer = window.setInterval(load, 30000); return () => window.clearInterval(timer); }, []);
  async function follow(item:any) {
    try { if (!item.read) await api('/notifications/' + item._id + '/read', { method: 'PATCH' }); setOpen(false); await load(); navigate(item.url || '/course/' + (item.course?._id || item.course) + '?tab=updates'); }
    catch(e:any) { setError(e.message); }
  }
  const unread = items.filter(x => !x.read).length;
  return <div className="notification-bell" onClick={e => e.stopPropagation()}><button type="button" className="notification-trigger" aria-label={'Notifications' + (unread ? ': ' + unread + ' unread' : '')} aria-expanded={open} onClick={() => { setOpen(!open); if (!open) load(); }}><Bell/>{unread > 0 && <span>{unread > 99 ? '99+' : unread}</span>}</button>{open && <div className="notification-popover"><div className="notification-heading"><strong>Course updates</strong><button aria-label="Close notifications" onClick={() => setOpen(false)}><X size={18}/></button></div>{error && <p className="error">{error}</p>}{items.length ? <div className="notification-items">{items.slice(0, 12).map(item => <button type="button" key={item._id} className={item.read ? 'read' : 'unread'} onClick={() => follow(item)}><span>{item.read ? <Check size={16}/> : <Bell size={16}/>}</span><div><b>{item.title}</b><small>{item.course?.title || 'Course'} · {item.message}</small><time>{new Date(item.createdAt).toLocaleString()}</time></div></button>)}</div> : <p className="notification-empty">No course updates yet.</p>}</div>}</div>;
}
