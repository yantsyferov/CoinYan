import { useState, useCallback, CSSProperties } from 'react';
import { useMutation } from '@apollo/client';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  RESET_PASSWORD_MUTATION,
  ResetPasswordData,
  ResetPasswordVariables,
} from '../../features/auth/reset-password/api/reset-password.mutation';
import { tokenStore } from '../../shared/lib/token-store';

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
  color: met ? '#16a34a' : '#6b7280',
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
    margin: '0 0 1.5rem',
    fontSize: '1.5rem',
    fontWeight: 600,
    color: '#111',
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
  inputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    fontSize: '0.8rem',
    color: '#ef4444',
    marginTop: '0.25rem',
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
  expiredError: {
    padding: '0.75rem',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '4px',
    fontSize: '0.875rem',
    color: '#dc2626',
    lineHeight: 1.5,
    marginBottom: '1.25rem',
  },
  mutationError: {
    marginTop: '1rem',
    padding: '0.75rem',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '4px',
    fontSize: '0.875rem',
    color: '#dc2626',
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

const EXPIRED_MESSAGE =
  'This reset link has expired or already been used. Please request a new one.';

function requirementIcon(met: boolean) {
  return met ? '✓' : '✗';
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [linkExpired, setLinkExpired] = useState(false);

  const navigate = useNavigate();

  const [resetPassword, { loading }] = useMutation<
    ResetPasswordData,
    ResetPasswordVariables
  >(RESET_PASSWORD_MUTATION);

  const requirements = checkPasswordRequirements(newPassword);
  const showRequirements = passwordFocused || newPassword.length > 0;
  const passwordsMatch = newPassword === confirmPassword;
  const showMismatchError = confirmTouched && !passwordsMatch;

  const isFormValid =
    allRequirementsMet(requirements) &&
    passwordsMatch &&
    confirmPassword.length > 0;

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!isFormValid || !token) return;

      try {
        const { data } = await resetPassword({
          variables: { input: { token, newPassword } },
        });

        if (data?.resetPassword) {
          tokenStore.set(data.resetPassword.accessToken);
          navigate('/');
        }
      } catch {
        setLinkExpired(true);
      }
    },
    [resetPassword, isFormValid, token, newPassword, navigate],
  );

  // No token in URL — show error state immediately
  if (!token || linkExpired) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h1 style={styles.heading}>Reset password</h1>
          <div style={styles.expiredError} role="alert">
            {EXPIRED_MESSAGE}
          </div>
          <p style={styles.backRow}>
            <Link to="/forgot-password" style={styles.backLink}>
              Request a new reset link
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.heading}>Reset password</h1>
        <form onSubmit={handleSubmit} noValidate>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>
              New password
              <input
                style={styles.input}
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                required
              />
              {showRequirements && (
                <ul style={styles.requirementsList}>
                  <li style={requirementItemStyle(requirements.minLength)}>
                    {requirementIcon(requirements.minLength)} At least 8
                    characters
                  </li>
                  <li style={requirementItemStyle(requirements.hasUppercase)}>
                    {requirementIcon(requirements.hasUppercase)} At least one
                    uppercase letter
                  </li>
                  <li style={requirementItemStyle(requirements.hasNumber)}>
                    {requirementIcon(requirements.hasNumber)} At least one
                    number
                  </li>
                </ul>
              )}
            </label>

            <label style={styles.label}>
              Confirm new password
              <input
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
            </label>
          </div>

          <button
            type="submit"
            disabled={!isFormValid || loading}
            style={{
              ...styles.submitButton,
              ...(!isFormValid || loading ? styles.submitButtonDisabled : {}),
            }}
          >
            {loading ? 'Resetting…' : 'Reset password'}
          </button>
        </form>
      </div>
    </div>
  );
}
