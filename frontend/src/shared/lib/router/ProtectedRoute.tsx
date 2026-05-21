import { useState, useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { tokenStore } from '../token-store';

type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

export function ProtectedRoute() {
  const [status, setStatus] = useState<AuthStatus>(
    tokenStore.get() ? 'authenticated' : 'checking',
  );

  useEffect(() => {
    if (status !== 'checking') return;

    // No token in memory — attempt a silent refresh via the HttpOnly cookie.
    fetch('/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ query: 'mutation { refresh { accessToken } }' }),
    })
      .then(res => res.json())
      .then((result: { data?: { refresh?: { accessToken?: string } } }) => {
        const token = result?.data?.refresh?.accessToken;
        if (token) {
          tokenStore.set(token);
          setStatus('authenticated');
        } else {
          tokenStore.clear();
          setStatus('unauthenticated');
        }
      })
      .catch(() => {
        tokenStore.clear();
        setStatus('unauthenticated');
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

  return <Outlet />;
}
