import { ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth-context';

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: 'student@lategenues.com', password: 'Demo@123' });
  const [show, setShow] = useState(false); const [error, setError] = useState(''); const [notice,setNotice]=useState(''); const [busy, setBusy] = useState(false); const [remember,setRemember]=useState(true);
  if (user) return <Navigate to="/dashboard"/>;
  async function submit(e) { e.preventDefault(); setBusy(true); setError(''); try { await login(form.email, form.password); if(!remember) sessionStorage.setItem('lg_session','temporary'); navigate('/dashboard'); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  async function forgot(){setError('');try{const x=await api('/auth/forgot-password',{method:'POST',body:JSON.stringify({email:form.email})});setNotice(x.message)}catch(e){setError(e.message)}}
  return <section className="auth-page"><div className="auth-panel"><div className="auth-intro"><span className="eyebrow">WELCOME BACK</span><h1>Your learning journey continues here.</h1><p>Classes, notes, exams and progress—all waiting in your personal dashboard.</p><div className="auth-quote">“Education is not preparation for life; education is life itself.”</div></div><form className="auth-form" onSubmit={submit}><div><span className="kicker">SECURE SIGN IN</span><h2>Log in to LateGenues</h2><p>Use your registered email or phone and password.</p></div>{error && <div className="error">{error}</div>}{notice&&<div className="success">{notice}</div>}<label>Email or phone<input value={form.email} onChange={e => setForm({...form,email:e.target.value})} required/></label><label>Password<div className="password"><input type={show?'text':'password'} value={form.password} onChange={e => setForm({...form,password:e.target.value})} required/><button type="button" onClick={()=>setShow(!show)}>{show?<EyeOff/>:<Eye/>}</button></div></label><div className="login-options"><label><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/> Remember me</label><button type="button" onClick={forgot}>Forgot password?</button></div><button className="btn wide" disabled={busy}>{busy?'Signing in…':'Sign in'} <ArrowRight/></button><small className="secure"><ShieldCheck/> Your account is protected with encrypted authentication.</small><div className="demo-note">New student? <Link to="/register"><b>Create an account</b></Link></div><div className="demo-note"><b>Demo:</b> student@lategenues.com · Demo@123</div></form></div></section>;
}
