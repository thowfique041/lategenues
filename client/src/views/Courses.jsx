import { ArrowRight, BookOpen, Clock, Search, Star, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';

const fallback = [
  { _id:'1', title:'SSC 2027 Complete Science', summary:'A focused program covering Physics, Chemistry, Biology and Higher Mathematics.', category:'academic', classLevel:'Class 10', subjects:['Physics','Chemistry','Biology'], price:2500, featured:true },
  { _id:'2', title:'HSC Physics Masterclass', summary:'Concept-first physics with live problem solving, notes and weekly model tests.', category:'academic', classLevel:'Class 11–12', subjects:['Physics'], price:1800, featured:true },
  { _id:'3', title:'University Admission A Unit', summary:'Complete admission preparation with expert classes and unlimited model tests.', category:'admission', classLevel:'Admission', subjects:['Physics','Chemistry','Math'], price:3200, featured:true },
];

export function Courses() {
  const [courses,setCourses] = useState(fallback); const [filter,setFilter]=useState('all'); const [search,setSearch]=useState('');
  useEffect(()=>{ api('/courses').then(setCourses).catch(()=>{}); },[]);
  const shown = useMemo(()=>courses.filter(c=>(filter==='all'||c.category===filter)&&c.title.toLowerCase().includes(search.toLowerCase())),[courses,filter,search]);
  return <section className="page-section"><div className="container"><div className="page-hero"><span className="kicker">FIND YOUR PATH</span><h1>Courses built for real progress</h1><p>Structured learning, expert guidance and regular practice—from school fundamentals to admission success.</p></div><div className="course-tools"><div className="filters">{['all','academic','admission'].map(x=><button className={filter===x?'active':''} onClick={()=>setFilter(x)} key={x}>{x}</button>)}</div><label className="search"><Search/><input placeholder="Search courses" value={search} onChange={e=>setSearch(e.target.value)}/></label></div><div className="course-grid">{shown.map((c,i)=><article className="course-card" key={c._id}><div className={`course-cover cover-${i%3}`}><span>{c.classLevel}</span><BookOpen/></div><div className="course-body"><div className="course-meta"><span><Star/> 4.9</span><span><Users/> 850+ learners</span></div><h3>{c.title}</h3><p>{c.summary}</p><div className="chips">{c.subjects?.slice(0,3).map(s=><span key={s}>{s}</span>)}</div><div className="course-foot"><div><small>COURSE FEE</small><b>{c.price ? `৳${c.price.toLocaleString()}` : 'Free'}</b></div><button className="round-button" aria-label="View course"><ArrowRight/></button></div></div></article>)}</div></div></section>;
}
