import { ArrowRight, BookOpen, CheckCircle2, CreditCard, Search, Star, Users, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth-context';

export function Courses() {
  const { user } = useAuth(); const navigate = useNavigate();
  const [courses,setCourses] = useState<any[]>([]);const [loading,setLoading]=useState(true); const [filter,setFilter]=useState('all'); const [search,setSearch]=useState(''); const [notice,setNotice]=useState('');
  const [selected,setSelected]=useState<any>(null); const [checkout,setCheckout]=useState({method:'bkash',transactionId:''}); const [busy,setBusy]=useState(false); const [error,setError]=useState('');

  useEffect(()=>{ api('/courses').then(setCourses).catch(e=>setError(e.message)).finally(()=>setLoading(false)); },[]);
  const shown = useMemo(()=>courses.filter(c=>(filter==='all'||c.category===filter)&&c.title.toLowerCase().includes(search.toLowerCase())),[courses,filter,search]);

  async function choose(course:any){
    setNotice(''); setError('');
    if(!user){navigate('/register');return}
    if(user.role!=='student'){setNotice('Course purchase is available from a student account.');return}
    if(course.enrolled){navigate(`/course/${course._id}`);return}
    if(Number(course.price)===0){await submitOrder(course,{method:'manual',transactionId:''});return}
    setSelected(course); setCheckout({method:'bkash',transactionId:''});
  }

  async function submitOrder(course:any,payment=checkout){
    setBusy(true);setError('');
    try{
      const result=await api(`/courses/${course._id}/order`,{method:'POST',body:JSON.stringify(payment)});
      setNotice(result.message); setCourses(x=>x.map(c=>c._id===course._id?{...c,enrolled:result.enrolled,paymentStatus:result.payment?.status}:c)); setSelected(null);
      if(result.enrolled)navigate(`/course/${course._id}`);
    }catch(e:any){setError(e.message)}finally{setBusy(false)}
  }

  function checkoutCourse(event:FormEvent){event.preventDefault();if(checkout.method!=='manual'&&!checkout.transactionId.trim()){setError('Enter the payment transaction ID.');return}submitOrder(selected,checkout)}

  return <section className="page-section"><div className="container"><div className="page-hero"><span className="kicker">FIND YOUR PATH</span><h1>Courses built for real progress</h1><p>Structured learning, expert guidance and regular practice—from school fundamentals to admission success.</p></div>
    <div className="course-tools"><div className="filters">{['all','academic','admission'].map(x=><button className={filter===x?'active':''} onClick={()=>setFilter(x)} key={x}>{x}</button>)}</div><label className="search"><Search/><input placeholder="Search courses" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
    {notice&&<div className="success">{notice}</div>}{error&&!selected&&<div className="error">{error}</div>}{loading&&<div className="lms-empty">Loading courses…</div>}{!loading&&!error&&shown.length===0&&<div className="lms-empty">No courses are available yet.</div>}
    <div className="course-grid">{shown.map((c,i)=><article className="course-card" key={c._id}><div className={`course-cover cover-${i%3}`}><span>{c.classLevel}</span><BookOpen/></div><div className="course-body"><div className="course-meta"><span><Star/> Structured lessons</span><span><Users/> Student access</span></div><h3>{c.title}</h3><p>{c.summary}</p><div className="chips">{c.subjects?.slice(0,3).map(s=><span key={s}>{s}</span>)}</div><div className="course-foot"><div><small>COURSE FEE</small><b>{c.price ? `৳${c.price.toLocaleString()}` : 'Free'}</b></div><button className="buy-button" onClick={()=>choose(c)}>{c.enrolled?<><CheckCircle2/> Open course</>:c.paymentStatus==='pending'?<><CreditCard/> Payment pending</>:<>Buy course <ArrowRight/></>}</button></div></div></article>)}</div>
  </div>
  {selected&&<div className="modal-backdrop"><form className="checkout-card" onSubmit={checkoutCourse}><button className="modal-close" type="button" onClick={()=>setSelected(null)}><X/></button><span className="kicker">SECURE ENROLLMENT</span><h2>Complete your order</h2><div className="checkout-course"><BookOpen/><div><b>{selected.title}</b><span>Total payable</span></div><strong>৳{selected.price.toLocaleString()}</strong></div><label>Payment method<select value={checkout.method} onChange={e=>setCheckout({...checkout,method:e.target.value})}><option value="bkash">bKash</option><option value="nagad">Nagad</option><option value="manual">Pay at office / manual</option></select></label>{checkout.method!=='manual'&&<label>Transaction ID<input required placeholder="Enter transaction ID" value={checkout.transactionId} onChange={e=>setCheckout({...checkout,transactionId:e.target.value})}/></label>}<div className="checkout-note">Send the exact course fee to the official LateGenues payment account, then submit the transaction ID. Contact support if you need the payment number.</div>{error&&<div className="error">{error}</div>}<button className="btn wide" disabled={busy}><CreditCard/>{busy?'Submitting...':'Submit order'}</button><small>Course access starts automatically after an admin confirms the payment.</small></form></div>}
  </section>;
}
