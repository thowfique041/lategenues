import { ArrowLeft, Camera, CheckCircle2, Save, UserRound } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth-context';

export function Profile() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({ name: '', phone: '', classLevel: '', group: '', bio: '', avatar: '' });
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [saved, setSaved] = useState(false);
  useEffect(() => { api('/auth/me').then(({ user: fresh }) => setForm({ name: fresh.name || '', phone: fresh.phone || '', classLevel: fresh.classLevel || '', group: fresh.group || '', bio: fresh.bio || '', avatar: fresh.avatar || '' })).catch((e) => setError(e.message)); }, []);
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(''); setSaved(false); try { const result = await api('/auth/profile', { method: 'PATCH', body: JSON.stringify(form) }); updateUser(result.user); setSaved(true); } catch (e: any) { setError(e.message); } finally { setBusy(false); } }
  return <section className="profile-page"><div className="profile-shell"><Link className="back" to="/dashboard"><ArrowLeft/> Back to dashboard</Link><div className="profile-card">
    <aside className="profile-summary"><div className="profile-avatar">{form.avatar?<img src={form.avatar} alt="Profile"/>:<UserRound/>}<span><Camera/></span></div><h1>{form.name || user.name}</h1><p>{user.email}</p><i>{user.role}</i><small>You can update your personal and learning information here.</small></aside>
    <form className="profile-form" onSubmit={submit}><div><span className="kicker">ACCOUNT SETTINGS</span><h2>Edit profile</h2><p>Your updated name will appear across your dashboard.</p></div>{error&&<div className="error">{error}</div>}{saved&&<div className="success"><CheckCircle2/> Profile updated successfully.</div>}<div className="profile-fields">
      <label>Full name<input required minLength={2} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Email address<input value={user.email} disabled/></label>
      <label>Phone number<input placeholder="01XXXXXXXXX" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label><label>Role<input value={user.role} disabled/></label>
      <label>Current class <small>Optional</small><input placeholder="Class 10" value={form.classLevel} onChange={e=>setForm({...form,classLevel:e.target.value})}/></label><label>Group <small>Optional</small><input placeholder="Science" value={form.group} onChange={e=>setForm({...form,group:e.target.value})}/></label>
      <label className="full">Profile photo URL <small>Optional</small><input type="url" placeholder="https://example.com/photo.jpg" value={form.avatar} onChange={e=>setForm({...form,avatar:e.target.value})}/></label><label className="full">About you <small>Optional</small><textarea maxLength={500} rows={5} placeholder="Write a short introduction" value={form.bio} onChange={e=>setForm({...form,bio:e.target.value})}/></label>
    </div><button className="btn profile-save" disabled={busy}><Save/>{busy?'Saving...':'Save changes'}</button></form>
  </div></div></section>;
}
