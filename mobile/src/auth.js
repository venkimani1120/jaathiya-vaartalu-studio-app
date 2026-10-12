import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, saveTokens, clearTokens, setSignedOutHandler } from './api';
import * as SecureStore from 'expo-secure-store';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSignedOutHandler(() => setUser(null));
    (async () => {
      try {
        if (await SecureStore.getItemAsync('refresh')) setUser((await api.get('/auth/me')).data.user);
      } catch { await clearTokens(); }
      setReady(true);
    })();
  }, []);

  const signIn = async (email, password) => {
    const { data } = await api.post('/auth/login', { email: email.trim(), password });
    await saveTokens(data);
    setUser(data.user);
  };
  const signUp = async form => (await api.post('/auth/signup', form)).data;
  const signOut = async () => { try { await api.post('/auth/logout'); } catch {} await clearTokens(); setUser(null); };

  // UI hints only; the server enforces every rule.
  const can = {
    review: user && ['admin', 'editor'].includes(user.role),
    epaper: user && ['admin', 'editor'].includes(user.role),
    users: user?.role === 'admin',
  };
  return <Ctx.Provider value={{ user, ready, signIn, signUp, signOut, can }}>{children}</Ctx.Provider>;
}
