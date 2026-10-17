import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { api, errMsg } from '../api';
import { Button, Chips, Spinner } from '../ui';

const ROLES = [['reporter', 'Reporter'], ['editor', 'Editor'], ['admin', 'Admin']];

// Admins approve new accounts and change roles. Any change signs that person out so it applies at once.
export default function Users() {
  const { user: me } = useAuth();
  const [filter, setFilter] = useState('pending');
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    try { setItems((await api('/users', { params: filter === 'pending' ? { pending: true } : filter === 'all' ? {} : { role: filter } })).items); setError(''); }
    catch (e) { setError(errMsg(e)); }
  };
  useEffect(() => { setItems(null); load(); }, [filter]);

  const update = async (u, body) => {
    setBusyId(u.id); setError('');
    try { await api(`/users/${u.id}`, { method: 'PATCH', body }); await load(); }
    catch (e) { setError(errMsg(e)); } finally { setBusyId(null); }
  };

  return (
    <main>
      <h2>Team accounts</h2>
      <Chips options={[['pending', 'Waiting for approval'], ['all', 'Everyone'], ...ROLES.map(([k, v]) => [k, v + 's'])]} value={filter} onChange={setFilter} />
      {error ? <p className="error" role="alert">{error}</p> : null}
      {!items ? <Spinner /> : !items.length ? <p className="muted" style={{ textAlign: 'center', marginTop: 30 }}>No accounts here.</p> : (
        <div className="table-wrap">
          <table className="list">
            <thead><tr><th>Name</th><th>Contact</th><th>Place</th><th>Role</th><th>Account</th></tr></thead>
            <tbody>
              {items.map(u => {
                const self = String(u.id) === String(me.id);
                return (
                  <tr key={u.id}>
                    <td><strong>{u.name}</strong>{self ? <span className="muted"> (you)</span> : null}<div className="muted" style={{ fontSize: 12 }}>Joined {new Date(u.createdAt).toLocaleDateString('en-IN')}</div></td>
                    <td>{u.email}<div className="muted">{u.phone || ''}</div></td>
                    <td>{u.constituency || ''}<div className="muted">{u.district || ''}</div></td>
                    <td>
                      <select value={u.role} disabled={self || busyId === u.id} onChange={e => update(u, { role: e.target.value })} aria-label={`Role for ${u.name}`}>
                        {ROLES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </td>
                    <td>
                      <Button kind={u.active ? 'danger' : 'primary'} disabled={self || busyId === u.id} onClick={() => update(u, { active: !u.active })}>
                        {u.active ? 'Deactivate' : 'Approve account'}</Button>
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
