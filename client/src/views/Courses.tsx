import { ArrowRight, BookOpen, Clock, Search, Star, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth-context';

const fallback = [
  { _id:'1', title:'SSC 2027 Complete Science', summary:'A focused program covering Physics, Chemistry, Biology and Higher Mathematics.', category:'academic', classLevel:'Class 10', subjects:['Physics','Chemistry','Biology'], price:2500, featured:true, enrolled:false },
  { _id:'2', title:'HSC Physics Masterclass', summary:'Concept-first physics with live problem solving, notes and weekly model tests.', category:'academic', classLevel:'Class 11–12', subjects:['Physics'], price:1800, featured:true, enrolled:false },
  { _id:'3', title:'University Admission A Unit', summary:'Complete admission preparation with expert classes and unlimited model tests.', category:'admission', classLevel:'Admission', subjects:['Physics','Chemistry','Math'], price:3200, featured:true, enrolled:false },
];

export function Courses() {
  const { user } = useAuth(); const navigate = useNavigate();
  const [courses,setCourses] = useState(fallback); const [filter,setFilter]=useState('all'); const [search,setSearch]=useState(''); const [notice,setNotice]=useState('');
  async function choose(course){ if(!user){navigate('/register');return} if(course.enrolled){navigate('/dashboard/courses');return} try{const result=await api(`/courses/${course._id}/order`,{method:'POST',body:JSON.stringify({method:'manual'})});setNotice(result.message);setCourses(x=>x.map(c=>c._id===course._id?{...c,enrolled:result.enrolled}:c))}catch(e){setNotice(e.message)} }
  useEffect(()=>{ api('/courses').then(setCourses).catch(()=>{}); },[]);
  const shown = useMemo(()=>courses.filter(c=>(filter==='all'||c.category===filter)&&c.title.toLowerCase().includes(search.toLowerCase())),[courses,filter,search]);
  return <section className="page-section"><div className="container"><div className="page-hero"><span className="kicker">FIND YOUR PATH</span><h1>Courses built for real progress</h1><p>Structured learning, expert guidance and regular practice—from school fundamentals to admission success.</p></div><div className="course-tools"><div className="filters">{['all','academic','admission'].map(x=><button className={filter===x?'active':''} onClick={()=>setFilter(x)} key={x}>{x}</button>)}</div><label className="search"><Search/><input placeholder="Search courses" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>{notice&&<div className="success">{notice}</div>}<div className="course-grid">{shown.map((c,i)=><article className="course-card" key={c._id}><div className={`course-cover cover-${i%3}`}><span>{c.classLevel}</span><BookOpen/></div><div className="course-body"><div className="course-meta"><span><Star/> 4.9</span><span><Users/> 850+ learners</span></div><h3>{c.title}</h3><p>{c.summary}</p><div className="chips">{c.subjects?.slice(0,3).map(s=><span key={s}>{s}</span>)}</div><div className="course-foot"><div><small>COURSE FEE</small><b>{c.price ? `৳${c.price.toLocaleString()}` : 'Free'}</b></div><button className="round-button" aria-label={c.enrolled?'Open course':'Enroll in course'} onClick={()=>choose(c)} title={c.enrolled?'Open course':'Enroll in course'}><ArrowRight/></button></div></div></article>)}</div></div></section>;
}
