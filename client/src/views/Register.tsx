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
  return <section className="auth-page"><div className="auth-panel"><div className="auth-intro"><span className="eyebrow">START LEARNING</span><h1>Your focused learning space starts here.</h1><p>Create a student profile, enroll in the right courses and keep every lesson in one secure place.</p><div className="auth-benefits"><span>✓ Access only the courses you enroll in</span><span>✓ Learn from any device, at your pace</span><span>✓ Classes, materials and exams together</span></div></div><form className="auth-form" onSubmit={submit}><div><span className="kicker">STUDENT REGISTRATION</span><h2>Create your account</h2><p>It only takes a minute to get started.</p></div>{error&&<div className="error">{error}</div>}<div className="auth-fields"><label className="full">Full name<input placeholder="Enter your full name" required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label className="full">Email address<input type="email" placeholder="you@example.com" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label>Phone number<input placeholder="01XXXXXXXXX" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label><label>Current class<input placeholder="Class 10" value={form.classLevel} onChange={e=>setForm({...form,classLevel:e.target.value})}/></label><label>Group<input placeholder="Science" value={form.group} onChange={e=>setForm({...form,group:e.target.value})}/></label><label>Password<input type="password" placeholder="At least 8 characters" minLength={8} required value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label></div><button className="btn wide" disabled={busy}>{busy?'Creating account…':'Create student account'} <ArrowRight/></button><small className="secure"><ShieldCheck/> Course content unlocks only after enrollment confirmation.</small><div className="auth-switch"><span>Already have an account?</span><Link to="/login">Sign in <ArrowRight/></Link></div></form></div></section>;
}
