import { useEffect, CSSProperties } from 'react';
import { useMutation, gql } from '@apollo/client';
import { useSearchParams, Link } from 'react-router-dom';

// ─── Mutation ─────────────────────────────────────────────────────────────────

const CONFIRM_EMAIL_CHANGE_MUTATION = gql`
  mutation ConfirmEmailChange($token: String!) {
    confirmEmailChange(token: $token) {
      id
      email
      displayName
    }
  }
`;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    fontFamily: 'system-ui, sans-serif',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
    padding: '2rem',
    width: '100%',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    textAlign: 'center',
  },
  heading: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 600,
    color: '#111',
  },
  successBox: {
    padding: '0.875rem 1rem',
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '4px',
    fontSize: '0.9375rem',
    color: '#15803d',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  errorBox: {
    padding: '0.875rem 1rem',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '4px',
    fontSize: '0.9375rem',
    color: '#dc2626',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  loading: {
    fontSize: '0.9375rem',
    color: '#6b7280',
  },
  backLink: {
    color: '#2563eb',
    textDecoration: 'none',
    fontWeight: 500,
    fontSize: '0.875rem',
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ConfirmEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [confirmEmailChange, { loading, data, error, called }] = useMutation(
    CONFIRM_EMAIL_CHANGE_MUTATION,
  );

  useEffect(() => {
    if (token) {
      confirmEmailChange({ variables: { token } });
    }
    // Run only once on mount — token is read from URL and does not change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isError = !token || (called && !loading && error);
  const isSuccess = called && !loading && !error && data;

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.heading}>Email Confirmation</h1>

        {loading && (
          <p style={styles.loading} role="status">
            Confirming your email address…
          </p>
        )}

        {isSuccess && (
          <>
            <div style={styles.successBox} role="status">
              Your email address has been updated.
            </div>
            <Link to="/profile" style={styles.backLink}>
              Back to profile
            </Link>
          </>
        )}

        {isError && (
          <>
            <div style={styles.errorBox} role="alert">
              This confirmation link has expired or already been used.
            </div>
            <Link to="/profile" style={styles.backLink}>
              Back to profile
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
