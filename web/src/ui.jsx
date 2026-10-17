import React, { useEffect, useRef, useState } from 'react';
import { STATUS } from './constants';
import { ROLE_LABEL } from './auth';

export const LOGO = './logo.png';   // public/logo.png: full logo
export const MARK = './mark.png';   // public/mark.png: torch and map only, for small sizes

export function Button({ kind = 'primary', className = '', type = 'button', ...props }) {
  return <button type={type} className={`btn btn-${kind} ${className}`} {...props} />;
}
export function Field({ label, hint, multiline, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      {multiline ? <textarea {...props} /> : <input {...props} />}
      {hint ? <small className="hint">{hint}</small> : null}
    </label>
  );
}
export function Chips({ label, options, value, onChange, disabled }) {
  return (
    <div className="field" style={label ? undefined : { margin: 0 }}>
      {label ? <span>{label}</span> : null}
      <div className="chips" role="group" aria-label={label}>
        {options.map(([k, v]) => (
          <button type="button" key={k} disabled={disabled} aria-pressed={value === k}
            className={`chip ${value === k ? 'on' : ''}`} onClick={() => onChange(k)}>{v}</button>
        ))}
      </div>
    </div>
  );
}
export const Badge = ({ status }) => <span className={`badge badge-${status}`}>{STATUS[status]?.label || status}</span>;
export const Spinner = () => <div className="spinner" role="status" aria-label="Loading" />;

export function Search({ value, onChange, placeholder = 'Search headlines' }) {
  return (
    <label className="search">
      <Icon name="search" size={16} />
      <input type="search" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} aria-label={placeholder} />
    </label>
  );
}
export function Empty({ title, children }) {
  return <div className="empty"><Icon name="news" size={36} /><b>{title}</b>{children}</div>;
}

const PATHS = {
  plus: 'M12 5v14M5 12h14',
  news: 'M4 5h13a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM19 9h1a1 1 0 0 1 1 1v8a2 2 0 0 1-2 2M8 9h7M8 13h7M8 17h4',
  check: 'M20 6 9 17l-5-5',
  user: 'M20 21a8 8 0 1 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
  lock: 'M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM8 11V7a4 4 0 1 1 8 0v4',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3',
  camera: 'M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  image: 'M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM3 16l5-5 4 4 3-3 6 6M15.5 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  back: 'M15 18l-6-6 6-6',
  chevron: 'M6 9l6 6 6-6',
  layout: 'M4 4h16v16H4zM4 9h16M10 9v11',
  users: 'M16 21v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-1a4 4 0 0 0-3-3.9M16 4.1a4 4 0 0 1 0 7.8',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
};
export function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

const initials = name => (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
export function Avatar({ user, size = 34 }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [user?.avatar]);
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }} aria-hidden="true">
      {user?.avatar && !broken ? <img src={user.avatar} alt="" onError={() => setBroken(true)} /> : initials(user?.name)}
    </span>
  );
}

function ProfileMenu({ user, onSignOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = e => { if (e.type === 'hashchange' || (e.type === 'keydown' ? e.key === 'Escape' : !ref.current.contains(e.target))) setOpen(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', close); window.addEventListener('hashchange', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); window.removeEventListener('hashchange', close); };
  }, [open]);
  return (
    <div className="menu-wrap" ref={ref}>
      <button type="button" className="avatar-btn" aria-haspopup="menu" aria-expanded={open} aria-label={`Account menu for ${user.name}`} onClick={() => setOpen(o => !o)}>
        <Avatar user={user} /><span className="nm">{user.name.split(' ')[0]}</span><Icon name="chevron" size={14} />
      </button>
      {open ? (
        <div className="menu" role="menu">
          <div className="menu-head"><Avatar user={user} size={40} /><div><b>{user.name}</b><span>{user.email}</span><em className="role-pill">{ROLE_LABEL[user.role] || user.role}</em></div></div>
          <a role="menuitem" href="#/profile"><Icon name="user" />My profile</a>
          <a role="menuitem" href="#/password"><Icon name="lock" />Change password</a>
          <hr />
          <button role="menuitem" type="button" className="danger" onClick={() => { setOpen(false); onSignOut(); }}><Icon name="logout" />Sign out</button>
        </div>
      ) : null}
    </div>
  );
}

export function TopBar({ user, onSignOut, children }) {
  return (
    <header className="topbar">
      <div className="topbar-in">
        <a className="brand" href="#/" aria-label="Jaathiya Vaartalu, home">
          <img src={MARK} alt="" /><span className="brand-txt"><b>Jaathiya Vaartalu</b><small>{user?.role === 'reporter' ? 'Reporter' : 'News desk'}</small></span>
        </a>
        <nav className="nav">{children}</nav>
        {user ? <ProfileMenu user={user} onSignOut={onSignOut} /> : null}
      </div>
    </header>
  );
}

export function AuthShell({ subtitle, wide, children }) {
  return (
    <div className="auth">
      <div className={`auth-card${wide ? ' wide' : ''}`}>
        <img className="auth-logo" src={LOGO} alt="Jaathiya Vaartalu News" />
        <div className="auth-title"><b>జాతియ వార్తలు</b><span>{subtitle}</span></div>
        {children}
      </div>
    </div>
  );
}
