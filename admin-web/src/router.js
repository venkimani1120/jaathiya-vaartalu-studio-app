import { useEffect, useState } from 'react';

// Hash routes (#/news/123) so the site works on any static host without server rewrites.
const current = () => window.location.hash.slice(1) || '/';
export function useRoute() {
  const [route, setRoute] = useState(current);
  useEffect(() => {
    const f = () => { setRoute(current()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return route;
}
export const go = path => { window.location.hash = path; };
