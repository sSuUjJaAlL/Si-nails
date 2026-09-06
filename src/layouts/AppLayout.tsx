import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.jpg';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/Button';
import { classNames } from '../utils/format';

type Variant = 'admin' | 'user';

const adminNav = [
  { to: '/admin/dashboard', label: 'Live Activity', end: true },
  { to: '/admin/clients', label: 'Clients' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/appointments', label: 'Appointments' },
  { to: '/admin/payments', label: 'Payments' },
  { to: '/admin/reports', label: 'Reports' },
  { to: '/admin/profile', label: 'Profile' },
];

const userNav = [
  { to: '/user/entries', label: 'Entries', end: true },
  { to: '/user/profile', label: 'Profile' },
];

export function AppLayout({ variant }: { variant: Variant }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const links = variant === 'admin' ? adminNav : userNav;
  const home = variant === 'admin' ? '/admin/dashboard' : '/user/entries';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className={classNames('app-shell', variant === 'user' && 'user-shell')}>
      <aside className={classNames('sidebar', open && 'open')}>
        <div className="sidebar-brand">
          <img src={logo} alt="SiNails" className="sidebar-logo" />
          <div>
            <p className="brand-name">SiNails</p>
            <p className="brand-sub">Studio</p>
          </div>
        </div>
        <div className="role-chip-wrap">
          <span className={classNames('role-chip', variant)}>
            {variant === 'admin' ? 'ADMIN' : 'USER'}
          </span>
        </div>
        <nav className="sidebar-nav">
          {links.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => classNames('nav-link', isActive && 'active')}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <p className="sidebar-tagline">Beautiful nails. Beautiful moments.</p>
        </div>
      </aside>

      {open && <div className="sidebar-overlay" onClick={() => setOpen(false)} />}

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="hamburger" onClick={() => setOpen(true)} aria-label="Open menu">
              <span />
              <span />
              <span />
            </button>
            <Link to={home} className="topbar-brand">
              <img src={logo} alt="" className="topbar-logo" />
              <span>SiNails Studio</span>
              <span className={classNames('role-chip', 'inline', variant)}>
                {variant === 'admin' ? 'ADMIN' : 'USER'}
              </span>
            </Link>
          </div>
          <div className="topbar-user">
            <div className="user-meta">
              <strong>{user?.name}</strong>
              <span>{variant === 'admin' ? 'Admin' : 'User'}</span>
            </div>
            <Button variant="secondary" size="sm" onClick={() => void handleLogout()}>
              Logout
            </Button>
          </div>
        </header>
        <main className="page-content">
          <Outlet context={{ variant }} />
        </main>
      </div>
    </div>
  );
}
