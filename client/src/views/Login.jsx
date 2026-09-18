import { ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth-context';

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: 'student@lategenues.com', password: 'Demo@123' });
  const [show, setShow] = useState(false); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/dashboard"/>;
  async function submit(e) { e.preventDefault(); setBusy(true); setError(''); try { await login(form.email, form.password); navigate('/dashboard'); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  return <section className="auth-page"><div className="auth-panel"><div className="auth-intro"><span className="eyebrow">WELCOME BACK</span><h1>Your learning journey continues here.</h1><p>Classes, notes, exams and progress—all waiting in your personal dashboard.</p><div className="auth-quote">“Education is not preparation for life; education is life itself.”</div></div><form className="auth-form" onSubmit={submit}><div><span className="kicker">SECURE SIGN IN</span><h2>Log in to LateGenues</h2><p>Use your registered email and password.</p></div>{error && <div className="error">{error}</div>}<label>Email address<input type="email" value={form.email} onChange={e => setForm({...form,email:e.target.value})} required/></label><label>Password<div className="password"><input type={show?'text':'password'} value={form.password} onChange={e => setForm({...form,password:e.target.value})} required/><button type="button" onClick={()=>setShow(!show)}>{show?<EyeOff/>:<Eye/>}</button></div></label><button className="btn wide" disabled={busy}>{busy?'Signing in…':'Sign in'} <ArrowRight/></button><small className="secure"><ShieldCheck/> Your account is protected with encrypted authentication.</small><div className="demo-note"><b>Demo:</b> student@lategenues.com · Demo@123</div></form></div></section>;
}
