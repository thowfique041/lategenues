import { BookOpen, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth-context';

export function Logo() {
  return <Link to="/" className="brand"><span className="brand-mark"><BookOpen size={22}/><i>✦</i></span><strong>Late<span>Genues</span></strong></Link>;
}

export function Layout() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  return <>
    <header className="site-header"><div className="container nav-wrap">
      <Logo />
      <button className="menu-button" onClick={() => setOpen(!open)} aria-label="Toggle menu">{open ? <X/> : <Menu/>}</button>
      <nav className={open ? 'nav open' : 'nav'} onClick={() => setOpen(false)}>
        <NavLink to="/">Home</NavLink><NavLink to="/courses">Courses</NavLink>
        <a href="/#features">Features</a><a href="/#about">About</a><a href="/#contact">Contact</a>
        {user ? <><NavLink className="btn btn-small" to="/dashboard">Dashboard</NavLink><button className="link-button" onClick={logout}>Log out</button></> : <NavLink className="btn btn-small" to="/login">Sign in</NavLink>}
      </nav>
    </div></header>
    <main><Outlet /></main>
    <footer id="contact"><div className="container footer-grid"><div><Logo/><p>Learn better. Prepare smarter. Grow without limits.</p></div><div><h4>Explore</h4><Link to="/courses">All courses</Link><a href="/#features">Features</a><Link to="/login">Student login</Link></div><div><h4>Contact</h4><a href="mailto:hello@lategenues.com">hello@lategenues.com</a><span>Dhaka, Bangladesh</span></div></div><div className="footer-bottom">© {new Date().getFullYear()} LateGenues. All rights reserved.</div></footer>
  </>;
}
