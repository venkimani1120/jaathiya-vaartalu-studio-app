import React from 'react';
import { AuthProvider, useAuth } from './auth';
import { useRoute } from './router';
import { Spinner, TopBar } from './ui';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Home from './pages/Home';
import NewsEditor from './pages/NewsEditor';

function Routes() {
  const { user, ready, signOut } = useAuth();
  const route = useRoute();
  if (!ready) return <Spinner />;
  if (!user) return route === '/signup' ? <Signup /> : <Login />;
  const m = route.match(/^\/news\/(new|[a-f0-9]{24})$/);
  return (
    <>
      <TopBar title="జాతియ వార్తలు · Reporter" user={user} onSignOut={signOut}>
        <a href="#/" className={m ? '' : 'on'}>My news</a>
        <a href="#/news/new" className={m?.[1] === 'new' ? 'on' : ''}>New news card</a>
      </TopBar>
      {m ? <NewsEditor key={m[1]} id={m[1] === 'new' ? null : m[1]} /> : <Home />}
    </>
  );
}
export default function App() {
  return <AuthProvider><Routes /></AuthProvider>;
}
