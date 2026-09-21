import { BookOpen, Menu, UserRound, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth-context';
import { NotificationBell } from './NotificationBell';

export function Logo() {
  return <Link to="/" className="brand"><span className="brand-mark"><BookOpen size={22}/><i>✦</i></span><strong>Late<span>Genues</span></strong></Link>;
}

export function Layout() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.classList.toggle('mobile-nav-open', open);
    return () => document.body.classList.remove('mobile-nav-open');
  }, [open]);
  return <>
    <header className="site-header"><div className="container nav-wrap">
      <Logo />
      {open && <button className="nav-backdrop" aria-label="Close menu" onClick={() => setOpen(false)}/>}
      <nav id="main-navigation" className={open ? 'nav open' : 'nav'} onClick={() => setOpen(false)}>
        <NavLink to="/">Home</NavLink><NavLink to="/courses">Courses</NavLink><NavLink to="/admission">Admission</NavLink>
        <NavLink to="/teachers">Teachers</NavLink><NavLink to="/about">About</NavLink><NavLink to="/contact">Contact</NavLink>
        {user ? <><NavLink className="btn btn-small" to="/dashboard">Dashboard</NavLink><NavLink className="profile-link" to="/profile"><UserRound/><span>{user.name}</span></NavLink><button className="link-button" onClick={logout}>Log out</button></> : <NavLink className="btn btn-small" to="/login">Sign in</NavLink>}
      </nav>
      <div className="header-actions">{user?.role === 'student' && <NotificationBell/>}<button type="button" className="menu-button" onClick={() => setOpen(!open)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="main-navigation">{open ? <X/> : <Menu/>}</button></div>
    </div></header>
    <main><Outlet /></main>
    <footer id="contact"><div className="container footer-grid"><div><Logo/><p>Learn better. Prepare smarter. Grow without limits.</p></div><div><h4>Explore</h4><Link to="/courses">All courses</Link><Link to="/books">Course books</Link><Link to="/notices">Notices</Link><Link to="/faq">FAQ</Link><Link to="/login">Student login</Link></div><div><h4>Contact</h4><a href="mailto:hello@lategenues.com">hello@lategenues.com</a><span>Dhaka, Bangladesh</span><a href="#">Facebook</a><a href="#">YouTube</a><a href="#">WhatsApp</a></div></div><div className="footer-bottom">© {new Date().getFullYear()} LateGenues. All rights reserved.</div></footer>
  </>;
}
