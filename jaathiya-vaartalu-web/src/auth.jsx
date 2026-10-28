import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, saveTokens, clearTokens, hasSession, logout, setSignedOutHandler } from './api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

// What each role can do in this app. UI hints only; the server enforces every rule.
export const permissionsFor = role => ({
  desk: role === 'editor' || role === 'admin',   // review, edit any news, e-paper
  users: role === 'admin',                        // approve accounts, change roles
  deleteAny: role === 'admin',                    // delete other people's news
  deleteEdition: role === 'admin',                // delete editions from the E-paper list
});
export const ROLE_LABEL = { reporter: 'Reporter', editor: 'Editor', admin: 'Admin' };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Every page needs a session: when it ends, the sign-in page shows (Routes renders only Login/Signup without a user).
    setSignedOutHandler(() => setUser(null));
    // Signed out in another tab (shared storage) or in the embedded layout studio.
    const gone = () => { if (!hasSession()) { setUser(null); window.location.hash = '/'; } };
    const onStorage = e => { if (e.key === 'jv_refresh' || e.key === null) gone(); };
    const onMessage = e => { if (e.origin === window.location.origin && e.data?.type === 'jv:signed-out') { clearTokens(); gone(); } };
    window.addEventListener('storage', onStorage); window.addEventListener('message', onMessage);
    (async () => {
      try { if (hasSession()) setUser((await api('/auth/me')).user); } catch { clearTokens(); }
      setReady(true);
    })();
    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener('message', onMessage); };
  }, []);

  const signIn = async (email, password) => {
    const data = await api('/auth/login', { method: 'POST', body: { email: email.trim(), password } });
    saveTokens(data);
    setUser(data.user);
    window.location.hash = '/';   // every role starts on its own home page
  };
  const signUp = form => api('/auth/signup', { method: 'POST', body: form });
  const signOut = async () => { await logout(); setUser(null); window.location.hash = '/'; };
  const updateProfile = async body => { const me = (await api('/auth/me', { method: 'PATCH', body })).user; setUser(me); return me; };
  // The server signs other devices out and returns fresh tokens for this one.
  const changePassword = async (currentPassword, newPassword) => {
    const data = await api('/auth/password', { method: 'POST', body: { currentPassword, newPassword } });
    saveTokens(data); setUser(data.user);
  };

  const can = permissionsFor(user?.role);
  return <Ctx.Provider value={{ user, ready, can, signIn, signUp, signOut, updateProfile, changePassword }}>{children}</Ctx.Provider>;
}
