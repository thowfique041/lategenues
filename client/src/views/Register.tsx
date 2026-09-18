import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth-context';

export function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', classLevel: '', group: '', password: '' });
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/dashboard" />;
  async function submit(e) { e.preventDefault(); setBusy(true); setError(''); try { await register(form); navigate('/dashboard'); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  return <section className="auth-page"><div className="auth-panel"><div className="auth-intro"><span className="eyebrow">START LEARNING</span><h1>Create your student account.</h1><p>Buy courses and access only the classes, materials and exams included in your enrollment.</p><div className="auth-quote">Your learning space stays private and course-specific.</div></div><form className="auth-form" onSubmit={submit}><div><span className="kicker">STUDENT REGISTRATION</span><h2>Open your account</h2><p>Already registered? <Link to="/login">Sign in</Link></p></div>{error&&<div className="error">{error}</div>}<label>Full name<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Email<input type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label>Phone<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label><label>Class<input placeholder="e.g. Class 10" value={form.classLevel} onChange={e=>setForm({...form,classLevel:e.target.value})}/></label><label>Group<input placeholder="e.g. Science" value={form.group} onChange={e=>setForm({...form,group:e.target.value})}/></label><label>Password<input type="password" minLength={8} required value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label><button className="btn wide" disabled={busy}>{busy?'Creating account…':'Create student account'} <ArrowRight/></button><small className="secure"><ShieldCheck/> Course content unlocks only after enrollment confirmation.</small></form></div></section>;
}
