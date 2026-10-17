import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, saveTokens, clearTokens, hasSession, setSignedOutHandler } from './api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

// This site is for reporters. Editors and admins use the Desk site.
const ALLOWED_ROLES = ['reporter'];
const WRONG_APP = 'This site is for reporters. Editors and admins, please use the Jaathiya Vaarthalu Desk.';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSignedOutHandler(() => setUser(null));
    (async () => {
      try {
        if (hasSession()) {
          const me = (await api('/auth/me')).user;
          if (ALLOWED_ROLES.includes(me.role)) setUser(me); else clearTokens();
        }
      } catch { clearTokens(); }
      setReady(true);
    })();
  }, []);

  const signIn = async (email, password) => {
    const data = await api('/auth/login', { method: 'POST', body: { email: email.trim(), password } });
    if (!ALLOWED_ROLES.includes(data.user.role)) throw new Error(WRONG_APP);
    saveTokens(data);
    setUser(data.user);
  };
  const signUp = form => api('/auth/signup', { method: 'POST', body: form });
  const signOut = async () => { try { await api('/auth/logout', { method: 'POST' }); } catch {} clearTokens(); setUser(null); };

  return <Ctx.Provider value={{ user, ready, signIn, signUp, signOut }}>{children}</Ctx.Provider>;
}
