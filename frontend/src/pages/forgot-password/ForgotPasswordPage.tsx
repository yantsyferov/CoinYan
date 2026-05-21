import { useState, useCallback, CSSProperties } from 'react';
import { useMutation } from '@apollo/client';
import { Link } from 'react-router-dom';
import {
  FORGOT_PASSWORD_MUTATION,
  ForgotPasswordData,
  ForgotPasswordVariables,
} from '../../features/auth/forgot-password/api/forgot-password.mutation';

const CONFIRMATION_MESSAGE =
  'If an account exists for this email, a reset link has been sent.';

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
  },
  heading: {
    margin: '0 0 0.75rem',
    fontSize: '1.5rem',
    fontWeight: 600,
    color: '#111',
  },
  description: {
    margin: '0 0 1.5rem',
    fontSize: '0.875rem',
    color: '#6b7280',
    lineHeight: 1.5,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    marginBottom: '1.25rem',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#333',
  },
  input: {
    padding: '0.5rem 0.75rem',
    fontSize: '1rem',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    outline: 'none',
    transition: 'border-color 0.15s',
  },
  submitButton: {
    width: '100%',
    padding: '0.625rem',
    fontSize: '1rem',
    fontWeight: 600,
    color: '#ffffff',
    backgroundColor: '#2563eb',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  submitButtonDisabled: {
    backgroundColor: '#93c5fd',
    cursor: 'not-allowed',
  },
  successMessage: {
    padding: '0.75rem',
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '4px',
    fontSize: '0.875rem',
    color: '#15803d',
    marginBottom: '1.25rem',
    lineHeight: 1.5,
  },
  backRow: {
    marginTop: '1.25rem',
    textAlign: 'center',
    fontSize: '0.875rem',
    color: '#6b7280',
  },
  backLink: {
    color: '#2563eb',
    textDecoration: 'none',
    fontWeight: 500,
  },
};

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const [forgotPassword] = useMutation<ForgotPasswordData, ForgotPasswordVariables>(
    FORGOT_PASSWORD_MUTATION,
  );

  const isDisabled = email.trim().length === 0 || loading;

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (isDisabled) return;

      setLoading(true);

      // Fire and forget — outcome is never revealed to the user
      forgotPassword({ variables: { email: email.trim() } }).catch(() => {
        // intentionally ignored — we always show the same message
      });

      setSubmitted(true);
      setLoading(false);
    },
    [forgotPassword, email, isDisabled],
  );

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.heading}>Forgot password</h1>

        {submitted ? (
          <>
            <p style={styles.successMessage} role="status">
              {CONFIRMATION_MESSAGE}
            </p>
            <p style={styles.backRow}>
              <Link to="/sign-in" style={styles.backLink}>
                Back to sign in
              </Link>
            </p>
          </>
        ) : (
          <>
            <p style={styles.description}>
              Enter your email address and we&apos;ll send you a link to reset
              your password.
            </p>
            <form onSubmit={handleSubmit} noValidate>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>
                  Email
                  <input
                    style={styles.input}
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={isDisabled}
                style={{
                  ...styles.submitButton,
                  ...(isDisabled ? styles.submitButtonDisabled : {}),
                }}
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>

            <p style={styles.backRow}>
              <Link to="/sign-in" style={styles.backLink}>
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
