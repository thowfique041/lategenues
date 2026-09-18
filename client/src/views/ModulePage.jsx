import { ArrowLeft, BookOpen, CalendarDays, CirclePlus, FileText, PlayCircle, Search } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

const names = { courses:'Courses',users:'Students & teachers',classes:'Classes',materials:'Materials & books',exams:'Online exams',qa:'Teacher Q&A',results:'Results & analytics',complaints:'Complaints',notices:'Notices',attendance:'Attendance',progress:'Student progress',routine:'Class routine' };
const samples = [
  { title:'SSC 2027 Complete Science',meta:'Class 10 · 4 subjects',status:'Active',icon:BookOpen },
  { title:"Newton's Laws: Problem Solving",meta:'Physics · Tomorrow, 8:00 PM',status:'Upcoming',icon:PlayCircle },
  { title:'Weekly Physics Model Test',meta:'20 questions · 30 minutes',status:'Published',icon:FileText },
  { title:'Physics Chapter 3 Lecture Sheet',meta:'PDF · Updated today',status:'Available',icon:FileText },
];

export function ModulePage() {
  const { module } = useParams(); const name = names[module] || 'Workspace';
  return <section className="module-page"><div className="container"><Link className="back" to="/dashboard"><ArrowLeft/> Dashboard</Link><div className="module-head"><div><span className="kicker">MANAGE & EXPLORE</span><h1>{name}</h1><p>Everything you need, organized in one focused workspace.</p></div><button className="btn"><CirclePlus/> Add new</button></div><div className="module-toolbar"><label className="search"><Search/><input placeholder={`Search ${name.toLowerCase()}`}/></label><button><CalendarDays/> Filter</button></div><div className="data-list">{samples.map(({title,meta,status,icon:Icon})=><article key={title}><div className="data-icon"><Icon/></div><div><b>{title}</b><span>{meta}</span></div><i>{status}</i><button>Open</button></article>)}</div></div></section>;
}
