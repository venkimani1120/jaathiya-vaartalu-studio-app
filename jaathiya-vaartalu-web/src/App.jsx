import React, { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { AuthProvider, useAuth } from './auth';
import { useRoute } from './router';
import { Icon, Spinner, TopBar } from './ui';
import Login from './pages/Login';
import Signup from './pages/Signup';
import MyNews from './pages/MyNews';
import Approved from './pages/Approved';
import DeskNews from './pages/DeskNews';
import Review from './pages/Review';
import Epapers from './pages/Epapers';
import StudioFrame, { STUDIO_URL, studioEmbeddable } from './pages/Studio';
import Users from './pages/Users';
import NewsEditor from './pages/NewsEditor';
import Profile from './pages/Profile';
import ChangePassword from './pages/ChangePassword';

const ID = '[a-f0-9]{24}';

// Top navigation per role: [tab id, hash, icon, label, permission needed]
const NAV = {
  reporter: [['home', '#/', 'news', 'My news'], ['approved', '#/approved', 'check', 'Approved · 30 days'], ['new', '#/news/new', 'plus', 'New news card']],
  desk: [['home', '#/', 'news', 'News'], ['epapers', '#/epapers', 'image', 'E-paper'], ['studio', '#/studio', 'layout', 'Layout studio'], ['users', '#/users', 'users', 'Team accounts', 'users'], ['new', '#/news/new', 'plus', 'New news card']],
};

// Returns [active tab, page] for the current route. Pages a role may not use fall back to its home page.
function page(route, can) {
  let m;
  if ((m = route.match(new RegExp(`^/news/(new|${ID})$`)))) return [m[1] === 'new' ? 'new' : 'home', <NewsEditor key={m[1]} id={m[1] === 'new' ? null : m[1]} />];
  if (route === '/profile') return ['', <Profile />];
  if (route === '/password') return ['', <ChangePassword />];
  if (can.desk) {
    if ((m = route.match(new RegExp(`^/review/(${ID})$`)))) return ['home', <Review key={m[1]} id={m[1]} />];
    if (route === '/epapers') return ['epapers', <Epapers />];
    if (route === '/studio') return ['studio', null];   // StudioFrame below
    if (route === '/users' && can.users) return ['users', <Users />];
    return ['home', <DeskNews />];
  }
  if (route === '/approved') return ['approved', <Approved />];
  return ['home', <MyNews />];
}

// Admins see how many sign-ups are waiting, on the Team accounts tab.
function usePendingCount(enabled, route) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!enabled) return setN(0);
    let live = true;
    const load = () => api('/users', { params: { pending: true } }).then(r => live && setN(r.items.length)).catch(() => {});
    load(); window.addEventListener('jv:users-changed', load);
    return () => { live = false; window.removeEventListener('jv:users-changed', load); };
  }, [enabled, route]);
  return n;
}

function Routes() {
  const { user, ready, signOut, can } = useAuth();
  const route = useRoute();
  const pending = usePendingCount(!!user && can.users, route);
  const studioSeen = useRef(false);   // the studio stays loaded after its first visit
  if (!ready) return <Spinner />;
  if (!user) return route === '/signup' ? <Signup /> : <Login />;
  const [tab, content] = page(route, can);
  const onStudio = tab === 'studio';
  const embed = studioEmbeddable();
  if (onStudio) studioSeen.current = true;
  const nav = (can.desk ? NAV.desk : NAV.reporter).filter(([, , , , need]) => !need || can[need]);
  return (
    <div className={`shell${onStudio && embed ? ' full' : ''}`}>
      <TopBar user={user} onSignOut={signOut}>
        {nav.map(([id, href, icon, label]) => (
          <a key={id} href={id === 'studio' && !embed ? STUDIO_URL : href} target={id === 'studio' && !embed ? '_blank' : undefined} rel="noreferrer"
            className={tab === id ? 'on' : ''} aria-current={tab === id ? 'page' : undefined}>
            <Icon name={icon} size={16} />{label}
            {id === 'users' && pending ? <span className="dot" aria-label={`${pending} waiting for approval`}>{pending}</span> : null}
          </a>
        ))}
      </TopBar>
      {content}
      {can.desk && embed && studioSeen.current ? <StudioFrame visible={onStudio} /> : null}
      {onStudio && !embed ? <main><p className="notice">The layout studio opened in a new tab. <a href={STUDIO_URL} target="_blank" rel="noreferrer">Open it again</a></p></main> : null}
    </div>
  );
}
export default function App() {
  return <AuthProvider><Routes /></AuthProvider>;
}
