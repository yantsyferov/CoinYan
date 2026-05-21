import { ApolloClient, InMemoryCache, from, fromPromise, HttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { tokenStore } from '../lib/token-store';

// ---------------------------------------------------------------------------
// HTTP link — credentials: 'include' sends the HttpOnly refresh_token cookie
// ---------------------------------------------------------------------------
const httpLink = new HttpLink({
  uri: '/graphql',
  credentials: 'include',
});

// ---------------------------------------------------------------------------
// Auth link — attaches Authorization header from the in-memory token store
// ---------------------------------------------------------------------------
const authLink = setContext((_, { headers }) => {
  const token = tokenStore.get();
  return {
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  };
});

// ---------------------------------------------------------------------------
// Refresh logic — module-level state to prevent concurrent refresh calls
// ---------------------------------------------------------------------------
let isRefreshing = false;
let pendingRequests: Array<() => void> = [];

const resolvePendingRequests = () => {
  pendingRequests.forEach(callback => callback());
  pendingRequests = [];
};

function silentRefresh(): Promise<string | null> {
  return fetch('/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // credentials: 'include' sends the HttpOnly refresh_token cookie
    credentials: 'include',
    body: JSON.stringify({ query: 'mutation { refresh { accessToken } }' }),
  })
    .then(res => res.json())
    .then((result: { data?: { refresh?: { accessToken?: string } } }) => {
      const newToken = result?.data?.refresh?.accessToken;
      if (!newToken) throw new Error('Refresh failed: no token in response');
      tokenStore.set(newToken);
      resolvePendingRequests();
      return newToken;
    })
    .catch(() => {
      pendingRequests = [];
      tokenStore.clear();
      window.location.href = '/sign-in';
      return null;
    })
    .finally(() => {
      isRefreshing = false;
    });
}

// ---------------------------------------------------------------------------
// Error link — detects 401 / UNAUTHENTICATED and triggers silent refresh
// ---------------------------------------------------------------------------
const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  const isUnauthenticated =
    graphQLErrors?.some(e => {
      const code = (e.extensions?.code as string | undefined)?.toLowerCase() ?? '';
      const message = e.message.toLowerCase();
      return (
        code === 'unauthenticated' ||
        message.includes('401') ||
        message.includes('unauthorized') ||
        message.includes('unauthenticated')
      );
    }) ||
    (networkError as (Error & { statusCode?: number }) | undefined)?.statusCode === 401;

  if (!isUnauthenticated) return;

  // Another refresh is already in-flight — queue this operation
  if (isRefreshing) {
    return fromPromise(
      new Promise<void>(resolve => {
        pendingRequests.push(resolve);
      }),
    ).flatMap(() => forward(operation));
  }

  isRefreshing = true;

  return fromPromise(silentRefresh()).flatMap(token => {
    if (!token) {
      // Redirect already triggered by silentRefresh; just forward as-is
      return forward(operation);
    }

    // Attach fresh token to the retried request
    operation.setContext(({ headers = {} }: { headers: Record<string, string> }) => ({
      headers: {
        ...headers,
        authorization: `Bearer ${token}`,
      },
    }));

    return forward(operation);
  });
});

// ---------------------------------------------------------------------------
// Apollo Client — link order: errorLink → authLink → httpLink
// ---------------------------------------------------------------------------
const client = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache(),
});

export default client;

// Named export kept for any existing imports that reference `apolloClient`
export { client as apolloClient };
