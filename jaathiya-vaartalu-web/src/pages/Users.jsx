import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { api, errMsg } from '../api';
import { Avatar, Button, Chips, Empty, Spinner } from '../ui';

const ROLES = [['reporter', 'Reporter'], ['editor', 'Editor'], ['admin', 'Admin']];

// Admins approve new accounts and change roles. Any change signs that person out so it applies at once.
export default function Users() {
  const { user: me } = useAuth();
  const [filter, setFilter] = useState('pending');
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    const params = filter === 'pending' ? { pending: true } : filter === 'inactive' ? { inactive: true } : filter === 'all' ? {} : { role: filter };
    try { setItems((await api('/users', { params })).items); setError(''); }
    catch (e) { setError(errMsg(e)); }
  };
  useEffect(() => { setItems(null); load(); }, [filter]);

  const update = async (u, body) => {
    setBusyId(u.id); setError('');
    try { await api(`/users/${u.id}`, { method: 'PATCH', body }); await load(); window.dispatchEvent(new Event('jv:users-changed')); }
    catch (e) { setError(errMsg(e)); } finally { setBusyId(null); }
  };

  return (
    <main>
      <div className="page-head"><div><h2>Team accounts</h2><p>Reporters and editors who sign up wait here until you approve them. Check the role before approving. Any change signs that person out so it applies at once.</p></div></div>
      <div className="toolbar">
        <Chips options={[['pending', 'New requests'], ['inactive', 'Turned off'], ['all', 'Everyone'], ...ROLES.map(([k, v]) => [k, v + 's'])]} value={filter} onChange={setFilter} />
      </div>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {!items ? (error ? null : <Spinner />) : !items.length ? <Empty title="No accounts here">{filter === 'pending' ? 'Nobody is waiting for approval.' : filter === 'inactive' ? 'No accounts are turned off.' : 'Try another filter.'}</Empty> : (
        <div className="table-wrap">
          <table className="list">
            <thead><tr><th>Name</th><th>Contact</th><th>Place</th><th>Role</th><th>Account</th></tr></thead>
            <tbody>
              {items.map(u => {
                const self = String(u.id) === String(me.id);
                const isNew = !u.active && !u.approvedAt;
                const roleName = ROLES.find(([k]) => k === u.role)?.[1] || u.role;
                return (
                  <tr key={u.id}>
                    <td><div className="who-cell"><Avatar user={u} size={34} /><div><strong>{u.name}</strong>{self ? <span className="muted"> (you)</span> : null}<div className="muted" style={{ fontSize: 12 }}>Joined {new Date(u.createdAt).toLocaleDateString('en-IN')}</div></div></div></td>
                    <td>{u.email}<div className="muted">{u.phone || ''}</div></td>
                    <td>{u.constituency || ''}<div className="muted">{u.district || ''}</div></td>
                    <td>
                      <select value={u.role} disabled={self || busyId === u.id} onChange={e => update(u, { role: e.target.value })} aria-label={`Role for ${u.name}`}>
                        {ROLES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 8 }}>
                        <Button kind={u.active ? 'danger' : isNew ? 'ok' : 'primary'} disabled={self || busyId === u.id} onClick={() => update(u, { active: !u.active })}>
                          {u.active ? 'Turn off' : isNew ? `Approve as ${roleName}` : 'Turn back on'}</Button>
                      </div>
                      <span className={`status-pill ${u.active ? 'on' : isNew ? 'new' : 'off'}`}>{u.active ? 'Active' : isNew ? 'New request' : 'Turned off'}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
