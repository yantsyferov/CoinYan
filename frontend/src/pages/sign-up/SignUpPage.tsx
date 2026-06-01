import { useState, useCallback, CSSProperties } from 'react';
import { useMutation } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import {
  SIGN_UP_MUTATION,
  SignUpData,
  SignUpVariables,
} from '../../features/auth/sign-up/api/sign-up.mutation';
import { tokenStore } from '../../shared/lib/token-store';
import { CurrencyPicker } from '../../shared/ui/CurrencyPicker';

interface PasswordRequirements {
  minLength: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
}

function checkPasswordRequirements(password: string): PasswordRequirements {
  return {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  };
}

function allRequirementsMet(reqs: PasswordRequirements): boolean {
  return reqs.minLength && reqs.hasUppercase && reqs.hasNumber;
}

const requirementItemStyle = (met: boolean): CSSProperties => ({
  fontSize: '0.8rem',
  color: met ? '#10B981' : '#94A3B8',
  display: 'flex',
  alignItems: 'center',
  gap: '0.3rem',
});

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
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
    marginTop: 4,
  },
  requirementsList: {
    listStyle: 'none',
    margin: '0.5rem 0 0',
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
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
  mutationError: {
    color: '#EF4444',
    fontSize: 13,
    marginTop: 16,
    textAlign: 'center',
  },
};

export function SignUpPage() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);

  const navigate = useNavigate();

  const [signUp, { loading, error }] = useMutation<SignUpData, SignUpVariables>(
    SIGN_UP_MUTATION,
  );

  const requirements = checkPasswordRequirements(password);
  const showRequirements = passwordFocused || password.length > 0;
  const passwordsMatch = password === confirmPassword;
  const showMismatchError = confirmTouched && !passwordsMatch;

  const isFormValid =
    displayName.trim().length > 0 &&
    email.trim().length > 0 &&
    allRequirementsMet(requirements) &&
    passwordsMatch &&
    confirmPassword.length > 0;

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!isFormValid) return;

      const { data } = await signUp({
        variables: {
          input: {
            displayName: displayName.trim(),
            email: email.trim(),
            password,
            baseCurrency,
          },
        },
      });

      if (data?.signUp) {
        tokenStore.set(data.signUp.accessToken);
        navigate('/');
      }
    },
    [signUp, isFormValid, displayName, email, password, baseCurrency],
  );

  const requirementIcon = (met: boolean) => (met ? '✓' : '✗');

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>💜 CoinYan</div>
        <p style={styles.subtitle}>Start managing your finances</p>

        <form onSubmit={handleSubmit} noValidate>
          <div style={styles.fieldWrapper}>
            <label style={styles.label} htmlFor="signup-name">Display name</label>
            <input
              id="signup-name"
              style={styles.input}
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>

          <div style={styles.fieldWrapper}>
            <label style={styles.label} htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              style={styles.input}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div style={styles.fieldWrapper}>
            <label style={styles.label} htmlFor="signup-password">Password</label>
            <input
              id="signup-password"
              style={styles.input}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              required
            />
            {showRequirements && (
              <ul style={styles.requirementsList}>
                <li style={requirementItemStyle(requirements.minLength)}>
                  {requirementIcon(requirements.minLength)} At least 8 characters
                </li>
                <li style={requirementItemStyle(requirements.hasUppercase)}>
                  {requirementIcon(requirements.hasUppercase)} At least one uppercase letter
                </li>
                <li style={requirementItemStyle(requirements.hasNumber)}>
                  {requirementIcon(requirements.hasNumber)} At least one number
                </li>
              </ul>
            )}
          </div>

          <div style={styles.fieldWrapper}>
            <label style={styles.label} htmlFor="signup-confirm">Confirm password</label>
            <input
              id="signup-confirm"
              style={{
                ...styles.input,
                ...(showMismatchError ? styles.inputError : {}),
              }}
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onBlur={() => setConfirmTouched(true)}
              required
            />
            {showMismatchError && (
              <span style={styles.errorText}>Passwords do not match</span>
            )}
          </div>

          <div style={styles.fieldWrapper}>
            <CurrencyPicker
              value={baseCurrency}
              onChange={setBaseCurrency}
              label="Base Currency"
            />
          </div>

          <button
            type="submit"
            disabled={!isFormValid || loading}
            style={{
              ...styles.submitButton,
              ...(!isFormValid || loading ? styles.submitButtonDisabled : {}),
            }}
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>

          {error && (
            <div style={styles.mutationError} role="alert">
              {error.graphQLErrors.length > 0
                ? error.graphQLErrors[0].message
                : error.message}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
