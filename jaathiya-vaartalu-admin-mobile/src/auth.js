import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, saveTokens, clearTokens, logout, setSignedOutHandler } from './api';
import * as SecureStore from 'expo-secure-store';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

// This app is for editors and admins. Reporters use the Reporter app.
const ALLOWED_ROLES = ['editor', 'admin'];
const WRONG_APP = 'This app is for editors and admins. Reporters, please use the Jaathiya Vaartalu Reporter app.';

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
  const signOut = async () => { await logout(); setUser(null); };

  // UI hints only; the server enforces every rule.
  const can = {
    review: !!user,
    epaper: !!user,
    users: user?.role === 'admin',
  };
  return <Ctx.Provider value={{ user, ready, signIn, signOut, can }}>{children}</Ctx.Provider>;
}
