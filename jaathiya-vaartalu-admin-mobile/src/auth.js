import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, saveTokens, clearTokens, logout, setSignedOutHandler } from './api';
import * as SecureStore from 'expo-secure-store';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

// This app is for editors and admins. Reporters use the Reporter app.
const ALLOWED_ROLES = ['editor', 'admin'];
const WRONG_APP = 'This app is for editors and admins. Reporters, please use the Jaathiya Vaartalu Reporter app.';

// Every role a member holds (a member can have several, e.g. Admin and Editor).
export const rolesOf = user => (user?.roles?.length ? user.roles : user?.role ? [user.role] : []);
const allowed = user => rolesOf(user).some(r => ALLOWED_ROLES.includes(r));

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSignedOutHandler(() => setUser(null));
    (async () => {
      try {
        if (await SecureStore.getItemAsync('refresh')) {
          const me = (await api.get('/auth/me')).data.user;
          if (allowed(me)) setUser(me); else await clearTokens();
        }
      } catch { await clearTokens(); }
      setReady(true);
    })();
  }, []);

  const signIn = async (email, password) => {
    const { data } = await api.post('/auth/login', { email: email.trim(), password });
    if (!allowed(data.user)) throw new Error(WRONG_APP);
    await saveTokens(data);
    setUser(data.user);
  };
  const signOut = async () => { await logout(); setUser(null); };
  const refreshUser = async () => setUser((await api.get('/auth/me')).data.user);
  const updateProfile = async body => { const me = (await api.patch('/auth/me', body)).data.user; setUser(me); return me; };
  // The server signs other devices out and returns fresh tokens for this one.
  const changePassword = async (currentPassword, newPassword) => {
    const { data } = await api.post('/auth/password', { currentPassword, newPassword });
    await saveTokens(data); setUser(data.user);
  };

  // UI hints only; the server enforces every rule.
  const can = {
    review: !!user,
    users: rolesOf(user).includes('admin'),
    imports: rolesOf(user).includes('editor'),   // upload newspapers: editors only, so an admin needs the Editor role too
  };
  return <Ctx.Provider value={{ user, ready, signIn, signOut, can, updateProfile, changePassword, refreshUser }}>{children}</Ctx.Provider>;
}
