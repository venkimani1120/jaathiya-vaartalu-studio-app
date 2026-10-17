import React from 'react';
import { AuthProvider, useAuth } from './auth';
import { useRoute } from './router';
import { Spinner, TopBar } from './ui';
import Login from './pages/Login';
import Home from './pages/Home';
import Review from './pages/Review';
import NewsEditor from './pages/NewsEditor';
import Users from './pages/Users';
import Epapers from './pages/Epapers';

const ID = '[a-f0-9]{24}';
function page(route, can) {
  let m;
  if ((m = route.match(new RegExp(`^/news/(new|${ID})$`)))) return ['news', <NewsEditor key={m[1]} id={m[1] === 'new' ? null : m[1]} />];
  if ((m = route.match(new RegExp(`^/review/(${ID})$`)))) return ['news', <Review key={m[1]} id={m[1]} />];
  if (route === '/epapers') return ['epapers', <Epapers />];
  if (route === '/users' && can.users) return ['users', <Users />];
  return ['news', <Home />];
}

function Routes() {
  const { user, ready, signOut, can } = useAuth();
  const route = useRoute();
  if (!ready) return <Spinner />;
  if (!user) return <Login />;
  const [tab, content] = page(route, can);
  return (
    <>
      <TopBar title="జాతియ వార్తలు · Desk" user={{ ...user, name: `${user.name} (${user.role})` }} onSignOut={signOut}>
        <a href="#/" className={tab === 'news' ? 'on' : ''}>News</a>
        <a href="#/epapers" className={tab === 'epapers' ? 'on' : ''}>E-paper</a>
        {can.users ? <a href="#/users" className={tab === 'users' ? 'on' : ''}>Team accounts</a> : null}
      </TopBar>
      {content}
    </>
  );
}
export default function App() {
  return <AuthProvider><Routes /></AuthProvider>;
}
