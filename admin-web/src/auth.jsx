import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, saveTokens, clearTokens, hasSession, setSignedOutHandler } from './api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

// This site is for editors and admins. Reporters use the Reporter site.
const ALLOWED_ROLES = ['editor', 'admin'];
const WRONG_APP = 'This site is for editors and admins. Reporters, please use the Jaathiya Vaarthalu Reporter site.';

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
  const signOut = async () => { try { await api('/auth/logout', { method: 'POST' }); } catch {} clearTokens(); setUser(null); };

  // UI hints only; the server enforces every rule.
  const can = { users: user?.role === 'admin', deleteAny: user?.role === 'admin' };
  return <Ctx.Provider value={{ user, ready, signIn, signOut, can }}>{children}</Ctx.Provider>;
}
