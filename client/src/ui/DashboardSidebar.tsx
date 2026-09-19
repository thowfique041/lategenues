import { BookOpen, CalendarDays, CircleHelp, ClipboardCheck, FileText, MessageSquareWarning, PanelLeftClose, PanelLeftOpen, PlayCircle, TrendingUp, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth-context';

const roleMenus = {
  admin: [['courses','Courses',BookOpen],['users','Users & guardians',Users],['batches','Batches',CalendarDays],['enrollments','Enrollments',Users],['classes','Classes',PlayCircle],['routines','Class routine',CalendarDays],['materials','Materials & books',FileText],['notebooks','Live notebooks',FileText],['exams','Exams',ClipboardCheck],['complaints','Complaints',MessageSquareWarning],['payments','Payments',FileText],['notifications','Notifications',FileText],['settings','Website content',FileText]],
  teacher: [['courses','My courses',BookOpen],['classes','Classes',PlayCircle],['routines','Class routine',CalendarDays],['materials','Materials',FileText],['notebooks','Live notebooks',FileText],['exams','Exams',ClipboardCheck],['qa','Student Q&A',CircleHelp],['notifications','Notifications',FileText]],
  student: [['courses','My courses',BookOpen],['classes','Live & recorded',PlayCircle],['routines','Class routine',CalendarDays],['materials','Materials & books',FileText],['notebooks','Live notebooks',FileText],['exams','Online exams',ClipboardCheck],['qa','Teacher Q&A',CircleHelp],['results','Results',TrendingUp],['payments','Payments',FileText],['notifications','Notifications',FileText]],
  guardian: [['progress','Student progress',TrendingUp],['results','Results',ClipboardCheck],['routine','Class routine',CalendarDays],['payments','Payments',FileText],['complaints','Complaints',MessageSquareWarning],['notices','Notices',FileText],['notifications','Notifications',FileText]],
};

export function DashboardSidebar() {
  const { user } = useAuth(); const { pathname } = useLocation();
  const [open, setOpen] = useState(() => localStorage.getItem('lg_sidebar') !== 'closed');
  const menus = roleMenus[user.role] || roleMenus.student;
  function toggle(){const next=!open;setOpen(next);localStorage.setItem('lg_sidebar',next?'open':'closed')}
  return <><button className={'sidebar-toggle '+(open?'is-open':'')} onClick={toggle} aria-label={open?'Close sidebar':'Open sidebar'} title={open?'Close sidebar':'Open sidebar'}>{open?<PanelLeftClose/>:<PanelLeftOpen/>}</button>
    <aside className={'dash-side '+(open?'open':'collapsed')}><div><small>WORKSPACE</small>{menus.map(([path,label,Icon])=>{const href=`/dashboard/${path}`;return <Link className={pathname===href?'active':''} to={href} key={path}><Icon/>{label}</Link>})}</div><div className="support-card"><CircleHelp/><b>Need help?</b><p>Our support team is ready.</p><a href="mailto:hello@lategenues.com">Contact support</a></div></aside>
  </>;
}
