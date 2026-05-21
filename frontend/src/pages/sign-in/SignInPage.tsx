import { useState, useCallback, CSSProperties } from 'react';
import { useMutation } from '@apollo/client';
import { useNavigate, Link } from 'react-router-dom';
import {
  SIGN_IN_MUTATION,
  SignInData,
  SignInVariables,
} from '../../features/auth/sign-in/api/sign-in.mutation';
import { tokenStore } from '../../shared/lib/token-store';

const LOCKOUT_MESSAGE =
  'Account temporarily locked due to too many failed attempts. Please try again in 15 minutes.';
const WRONG_CREDENTIALS_MESSAGE = 'Incorrect email or password';

function resolveErrorMessage(message: string): string {
  if (message.toLowerCase().includes('locked')) {
    return LOCKOUT_MESSAGE;
  }
  return WRONG_CREDENTIALS_MESSAGE;
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: '48px 40px',
    width: '100%',
    maxWidth: 420,
    boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
  },
  logo: {
    textAlign: 'center',
    fontSize: 28,
    fontWeight: 800,
    color: '#4F46E5',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 15,
    color: '#475569',
    marginBottom: 32,
    margin: '0 0 32px',
  },
  fieldWrapper: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
    display: 'block',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 10,
    border: '1.5px solid #E2E8F0',
    fontSize: 15,
    color: '#0F172A',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  forgotPasswordRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: 16,
  },
  forgotPasswordLink: {
    fontSize: 13,
    color: '#7C3AED',
    textDecoration: 'none',
    fontWeight: 500,
  },
  mutationError: {
    color: '#EF4444',
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center',
  },
  submitButton: {
    width: '100%',
    padding: 14,
    background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
    color: '#fff',
    fontWeight: 700,
    fontSize: 15,
    borderRadius: 12,
    border: 'none',
    cursor: 'pointer',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  signUpRow: {
    marginTop: 24,
    textAlign: 'center',
    fontSize: 14,
    color: '#475569',
  },
  signUpLink: {
    color: '#7C3AED',
    fontWeight: 600,
    textDecoration: 'none',
  },
};

export function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLockedOut, setIsLockedOut] = useState(false);

  const navigate = useNavigate();

  const [signIn, { loading }] = useMutation<SignInData, SignInVariables>(
    SIGN_IN_MUTATION,
  );

  const isFormValid = email.trim().length > 0 && password.length > 0;
  const isDisabled = !isFormValid || loading || isLockedOut;

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!isFormValid) return;

      setErrorMessage(null);

      try {
        const { data } = await signIn({
          variables: {
            input: {
              email: email.trim(),
              password,
            },
          },
        });

        if (data?.signIn) {
          tokenStore.set(data.signIn.accessToken);
          navigate('/');
        }
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'graphQLErrors' in err) {
          const apolloError = err as {
            graphQLErrors: Array<{ message: string }>;
            message: string;
          };
          const rawMessage =
            apolloError.graphQLErrors.length > 0
              ? apolloError.graphQLErrors[0].message
              : apolloError.message;
          const resolved = resolveErrorMessage(rawMessage);
          setErrorMessage(resolved);
          if (resolved === LOCKOUT_MESSAGE) {
            setIsLockedOut(true);
          }
        } else {
          setErrorMessage(WRONG_CREDENTIALS_MESSAGE);
        }
      }
    },
    [signIn, isFormValid, email, password],
  );

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>💜 CoinYan</div>
        <p style={styles.subtitle}>Welcome back</p>

        <form onSubmit={handleSubmit} noValidate>
          <div style={styles.fieldWrapper}>
            <label style={styles.label} htmlFor="signin-email">Email</label>
            <input
              id="signin-email"
              style={styles.input}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div style={styles.fieldWrapper}>
            <label style={styles.label} htmlFor="signin-password">Password</label>
            <input
              id="signin-password"
              style={styles.input}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div style={styles.forgotPasswordRow}>
            <Link to="/forgot-password" style={styles.forgotPasswordLink}>
              Forgot password?
            </Link>
          </div>

          {errorMessage && (
            <div style={styles.mutationError} role="alert">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isDisabled}
            style={{
              ...styles.submitButton,
              ...(isDisabled ? styles.submitButtonDisabled : {}),
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p style={styles.signUpRow}>
          Don&apos;t have an account?{' '}
          <Link to="/sign-up" style={styles.signUpLink}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
