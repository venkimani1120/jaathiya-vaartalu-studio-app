import React from 'react';
import { STATUS } from './constants';

export function Button({ kind = 'primary', className = '', type = 'button', ...props }) {
  return <button type={type} className={`btn btn-${kind} ${className}`} {...props} />;
}
export function Field({ label, multiline, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      {multiline ? <textarea {...props} /> : <input {...props} />}
    </label>
  );
}
export function Chips({ label, options, value, onChange, disabled }) {
  return (
    <div className="field">
      {label ? <span>{label}</span> : null}
      <div className="chips">
        {options.map(([k, v]) => (
          <button type="button" key={k} disabled={disabled} aria-pressed={value === k}
            className={`chip ${value === k ? 'on' : ''}`} onClick={() => onChange(k)}>{v}</button>
        ))}
      </div>
    </div>
  );
}
export const Badge = ({ status }) => <span className="badge" style={{ background: STATUS[status]?.color }}>{STATUS[status]?.label || status}</span>;
export const Spinner = () => <div className="spinner" role="status" aria-label="Loading" />;

export function TopBar({ title, user, onSignOut, children }) {
  return (
    <header className="topbar">
      <a className="brand" href="#/">{title}</a>
      <nav>{children}</nav>
      {user ? <div className="who"><span>{user.name}</span><button type="button" className="link" onClick={onSignOut}>Sign out</button></div> : null}
    </header>
  );
}
