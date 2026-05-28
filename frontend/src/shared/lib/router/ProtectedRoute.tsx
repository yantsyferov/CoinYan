import { useState, useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { tokenStore } from '../token-store';
import { BottomNav } from '../../ui/BottomNav';

type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

// Module-level promise so the fetch fires the moment this module is evaluated
// (before the first React render) and is shared if ProtectedRoute re-mounts.
// Reset to null on each full page load via module re-initialisation.
let refreshPromise: Promise<string | null> | null = null;

function getRefreshPromise(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = fetch('/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ query: 'mutation { refresh { accessToken } }' }),
    })
      .then(res => res.json())
      .then((result: { data?: { refresh?: { accessToken?: string } } }) =>
        result?.data?.refresh?.accessToken ?? null,
      )
      .catch(() => null);
  }
  return refreshPromise;
}

export function ProtectedRoute() {
  const [status, setStatus] = useState<AuthStatus>(() => {
    if (tokenStore.get()) return 'authenticated';
    // Kick off the refresh request synchronously during state initialisation so
    // it is in-flight before the first render.  This prevents a race in headless
    // Playwright where networkidle fires in the gap between the initial render
    // and a useEffect-based fetch, causing intermittent auth-redirect failures.
    getRefreshPromise();
    return 'checking';
  });

  useEffect(() => {
    if (status !== 'checking') return;

    getRefreshPromise().then(token => {
      if (token) {
        tokenStore.set(token);
        setStatus('authenticated');
      } else {
        tokenStore.clear();
        setStatus('unauthenticated');
      }
    });
  }, [status]);

  if (status === 'checking') {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <span>Loading…</span>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/sign-in" replace />;
  }

  return (
    <>
      <div style={{ paddingBottom: 64 }}>
        <Outlet />
      </div>
      <BottomNav />
    </>
  );
}
