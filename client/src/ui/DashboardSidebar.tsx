import { BookOpen, CalendarDays, CheckCircle2, CircleHelp, ClipboardCheck, FileText, MessageSquareWarning, PlayCircle, TrendingUp, Users } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth-context';

const roleMenus = {
  admin: [['courses','Courses',BookOpen],['users','Users & guardians',Users],['batches','Batches',CalendarDays],['enrollments','Enrollments',Users],['classes','Classes',PlayCircle],['routines','Class routine',CalendarDays],['materials','Materials & books',FileText],['notebooks','Live notebooks',FileText],['exams','Exams',ClipboardCheck],['attendance','Attendance',CheckCircle2],['complaints','Complaints',MessageSquareWarning],['payments','Payments',FileText],['notifications','Notifications',FileText],['settings','Website content',FileText]],
  teacher: [['courses','My courses',BookOpen],['classes','Classes',PlayCircle],['routines','Class routine',CalendarDays],['materials','Materials',FileText],['notebooks','Live notebooks',FileText],['exams','Exams',ClipboardCheck],['qa','Student Q&A',CircleHelp],['attendance','Attendance',CheckCircle2],['notifications','Notifications',FileText]],
  student: [['courses','My courses',BookOpen],['classes','Live & recorded',PlayCircle],['routines','Class routine',CalendarDays],['materials','Materials & books',FileText],['notebooks','Live notebooks',FileText],['exams','Online exams',ClipboardCheck],['qa','Teacher Q&A',CircleHelp],['results','Results',TrendingUp],['attendance','Attendance',CheckCircle2],['payments','Payments',FileText],['notifications','Notifications',FileText]],
  guardian: [['progress','Student progress',TrendingUp],['attendance','Attendance',CheckCircle2],['results','Results',ClipboardCheck],['routine','Class routine',CalendarDays],['payments','Payments',FileText],['complaints','Complaints',MessageSquareWarning],['notices','Notices',FileText],['notifications','Notifications',FileText]],
};

export function DashboardSidebar() {
  const { user } = useAuth(); const { pathname } = useLocation();
  const menus = roleMenus[user.role] || roleMenus.student;
  return <aside className="dash-side"><div><small>WORKSPACE</small>{menus.map(([path,label,Icon])=>{const href=`/dashboard/${path}`;return <Link className={pathname===href?'active':''} to={href} key={path}><Icon/>{label}</Link>})}</div><div className="support-card"><CircleHelp/><b>Need help?</b><p>Our support team is ready.</p><a href="mailto:hello@lategenues.com">Contact support</a></div></aside>;
}
