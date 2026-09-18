import { ArrowRight, Award, BookOpen, CheckCircle2, ClipboardCheck, GraduationCap, Laptop, MessageCircleQuestion, PlayCircle, Sparkles, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

const features = [
  [PlayCircle, 'Live & recorded classes', 'Learn live or revisit every lesson at your own pace.'],
  [BookOpen, 'Digital materials', 'Lecture sheets, notebooks and course books in one place.'],
  [ClipboardCheck, 'Online exams', 'Timed model tests with instant results and progress insights.'],
  [MessageCircleQuestion, 'Teacher Q&A', 'Ask course-specific questions and get focused answers.'],
  [Users, 'Guardian connection', 'Attendance, results, notices and support for guardians.'],
  [Award, 'Progress that shows', 'Track completion, strengths and areas that need improvement.'],
];

export function Home() {
  return <>
    <section className="hero"><div className="hero-orb one"/><div className="hero-orb two"/><div className="container hero-grid">
      <div className="hero-copy"><div className="eyebrow"><Sparkles size={16}/> Learning, reimagined</div><h1>Learn better.<br/><span>Prepare smarter.</span></h1><p>One focused platform for classes 6–12 and admission preparation—live classes, recorded lessons, exams, notes and teacher support.</p><div className="hero-actions"><Link className="btn" to="/courses">Explore courses <ArrowRight size={18}/></Link><Link className="btn ghost" to="/login">Go to dashboard</Link></div><div className="trust-row"><span><b>6–12</b> Academic</span><span><b>24/7</b> Learning access</span><span><b>1:1</b> Teacher support</span></div></div>
      <div className="hero-visual"><div className="dashboard-preview"><div className="preview-top"><span className="dot red"/><span className="dot yellow"/><span className="dot green"/></div><div className="welcome-card"><div><small>WELCOME BACK</small><h3>Keep learning, Ayman 👋</h3><p>Your Physics class starts tomorrow.</p></div><div className="progress-ring">82<small>%</small></div></div><div className="mini-grid"><div><PlayCircle/><span>Next live class</span><b>Physics · 8 PM</b></div><div><ClipboardCheck/><span>Weekly test</span><b>20 questions</b></div></div><div className="lesson-card"><span className="lesson-icon"><Laptop/></span><div><small>CONTINUE LEARNING</small><b>Motion & Measurement</b><i><span style={{width:'68%'}}/></i></div><strong>68%</strong></div></div><div className="float-badge top"><CheckCircle2/> Exam complete</div><div className="float-badge bottom"><GraduationCap/> 12K+ learners</div></div>
    </div></section>
    <section className="logo-strip"><div className="container"><span>Everything you need to succeed</span><b>LIVE CLASSES</b><b>SMART EXAMS</b><b>EXPERT TEACHERS</b><b>DIGITAL NOTES</b></div></section>
    <section id="features" className="section"><div className="container"><div className="section-head"><div><span className="kicker">A COMPLETE LEARNING SYSTEM</span><h2>Built around how students actually learn</h2></div><p>Less switching between apps. More focus, feedback and measurable progress.</p></div><div className="feature-grid">{features.map(([Icon,title,text]) => <article className="feature-card" key={title}><div className="feature-icon"><Icon/></div><h3>{title}</h3><p>{text}</p><a href="#contact">Learn more <ArrowRight size={15}/></a></article>)}</div></div></section>
    <section id="about" className="section soft"><div className="container split"><div className="story-card"><span>Physics</span><h3>Newton's Laws</h3><p>Live notebook</p><div className="formula">F = ma</div><div className="scribble"/><small>Updated live by your teacher</small></div><div><span className="kicker">ONE PLACE. EVERY STEP.</span><h2>From the first lesson to the final result</h2><p className="lead">LateGenues connects learning content, teacher guidance and progress data—so students always know what to do next.</p><ul className="check-list"><li><CheckCircle2/> Organized by class, course, subject and chapter</li><li><CheckCircle2/> Role-based access for every user</li><li><CheckCircle2/> Designed for mobile-first learners in Bangladesh</li><li><CheckCircle2/> Guardian visibility without distracting the student</li></ul><Link className="text-link" to="/courses">See available courses <ArrowRight/></Link></div></div></section>
    <section className="cta"><div className="container"><div><span>YOUR NEXT CHAPTER STARTS HERE</span><h2>Ready to learn without limits?</h2></div><Link className="btn light" to="/courses">Find your course <ArrowRight/></Link></div></section>
  </>;
}
