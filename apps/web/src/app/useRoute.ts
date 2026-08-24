/**
 * useRoute — minimal client-side router hook.
 *
 * Encapsulates window.location.pathname into a React state value and keeps it
 * in sync with the browser's History API (back/forward, pushState).
 *
 * Routes supported:
 *   /           → 'dashboard'
 *   /expedientes → 'expedientes'
 *   /preparacion → 'preparacion'
 *   <anything else> → 'not-found'
 *
 * Navigation is done via the exported `navigate(path)` helper, which calls
 * `window.history.pushState` and dispatches a `popstate` event so this hook
 * reacts to it — identical to how browsers fire popstate on back/forward.
 *
 * Direct navigation (hard refresh) works because the initial pathname is read
 * from window.location on mount.
 */

import { useEffect, useState } from 'react';

export type Route = 'dashboard' | 'expedientes' | 'preparacion' | 'not-found';

function parsePathname(pathname: string): Route {
  switch (pathname) {
    case '/':
    case '':
      return 'dashboard';
    case '/expedientes':
      return 'expedientes';
    case '/preparacion':
      return 'preparacion';
    default:
      return 'not-found';
  }
}

/** Navigate to a path without a full page reload. */
export function navigate(path: string): void {
  window.history.pushState(null, '', path);
  // Dispatch synthetic popstate so useRoute (and any other listener) reacts.
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() =>
    parsePathname(window.location.pathname),
  );

  useEffect(() => {
    function handlePopState() {
      setRoute(parsePathname(window.location.pathname));
    }
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  return route;
}
