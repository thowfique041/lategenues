import { BookOpen, CheckCircle2, GraduationCap, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';

const copy = {
  about: ['About LateGenues','We bring coaching management and digital learning together, helping students learn consistently with expert guidance, focused practice and transparent progress.'],
  contact: ['Contact & support','Questions about courses, admission or your account? Our support team is ready to help.'],
  faq: ['Frequently asked questions','Clear answers about classes, courses, exams and your LateGenues account.'],
  teachers: ['Learn from dedicated teachers','Experienced educators who explain clearly, answer questions and care about every student’s progress.'],
  books: ['Course books & resources','Find course-aligned books, question banks, short notes and lecture sheets.'],
  notices: ['Notices & updates','Admission announcements, schedules, exams and important coaching updates.'],
  admission: ['Admission preparation','Focused university, medical, engineering and GST admission programs.'],
};
const faqs = [['How do I join a live class?','Log in, open Live & Recorded Classes, and select Join when the class begins.'],['Can I watch a missed class?','Yes. Recordings appear in your course when the teacher publishes them.'],['How do online exams work?','Open Online Exams, start an available exam, answer within the timer and submit for results.'],['Can guardians see progress?','A linked guardian can view attendance, results, routine, notices and complaints.']];

export function PublicPage({ type }) {
  const { level } = useParams(); const [items,setItems]=useState([]); const title = type==='class' ? `Class ${level}` : copy[type]?.[0]; const description = type==='class' ? `Complete academic support for Class ${level}, organized by course, subject and chapter.` : copy[type]?.[1];
  useEffect(()=>{ if(['books','notices'].includes(type)) api(`/content?type=${type==='books'?'book':'notice'}`).then(setItems).catch(()=>{}); if(type==='admission'||type==='class') api('/courses').then(x=>setItems(x.filter(c=>type==='admission'?c.category==='admission':c.classLevel?.includes(level)))).catch(()=>{}); },[type,level]);
  return <section className="page-section public-detail"><div className="container"><div className="page-hero"><span className="kicker">LATEGENUES</span><h1>{title}</h1><p>{description}</p></div>
    {type==='about' && <div className="info-grid"><article><GraduationCap/><h3>Student first</h3><p>Every feature is designed to reduce distraction and improve learning outcomes.</p></article><article><BookOpen/><h3>Everything connected</h3><p>Classes, notes, tests, results and support work together in one system.</p></article><article><CheckCircle2/><h3>Visible progress</h3><p>Students and guardians can understand progress and take the right next step.</p></article></div>}
    {type==='contact' && <div className="contact-grid"><a href="tel:+880000000000"><Phone/> <div><b>Call us</b><span>+880 0000-000000</span></div></a><a href="mailto:hello@lategenues.com"><Mail/><div><b>Email</b><span>hello@lategenues.com</span></div></a><a href="https://wa.me/880000000000"><MessageCircle/><div><b>WhatsApp</b><span>Chat with LateGenues</span></div></a><div><MapPin/><div><b>Office</b><span>Dhaka, Bangladesh</span></div></div></div>}
    {type==='faq' && <div className="faq-list">{faqs.map(([q,a])=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>}
    {type==='teachers' && <div className="empty-card"><GraduationCap/><h3>Teacher profiles are managed from the Admin dashboard</h3><p>Add qualifications, subjects, experience and assigned courses to publish real profiles here.</p></div>}
    {items.length>0 && <div className="resource-grid">{items.map(x=><article key={x._id}><span>{x.category||x.type||'Resource'}</span><h3>{x.title}</h3><p>{x.summary||x.description||x.subject||'Available for enrolled students.'}</p></article>)}</div>}
  </div></section>;
}
