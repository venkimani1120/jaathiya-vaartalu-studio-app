import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, saveTokens, clearTokens, setSignedOutHandler } from './api';
import * as SecureStore from 'expo-secure-store';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

// This app is for reporters. Editors and admins use the Desk app.
const ALLOWED_ROLES = ['reporter'];
const WRONG_APP = 'This app is for reporters. Editors and admins, please use the Jaathiya Vaartalu Desk app.';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSignedOutHandler(() => setUser(null));
    (async () => {
      try {
        if (await SecureStore.getItemAsync('refresh')) {
          const me = (await api.get('/auth/me')).data.user;
          if (ALLOWED_ROLES.includes(me.role)) setUser(me); else await clearTokens();
        }
      } catch { await clearTokens(); }
      setReady(true);
    })();
  }, []);

  const signIn = async (email, password) => {
    const { data } = await api.post('/auth/login', { email: email.trim(), password });
    if (!ALLOWED_ROLES.includes(data.user.role)) throw new Error(WRONG_APP);
    await saveTokens(data);
    setUser(data.user);
  };
  const signUp = async form => (await api.post('/auth/signup', form)).data;
  const signOut = async () => { try { await api.post('/auth/logout'); } catch {} await clearTokens(); setUser(null); };

  return <Ctx.Provider value={{ user, ready, signIn, signUp, signOut }}>{children}</Ctx.Provider>;
}
