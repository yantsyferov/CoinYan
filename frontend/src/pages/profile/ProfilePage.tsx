import { useState, useCallback, CSSProperties } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation, gql } from '@apollo/client';
import { useCurrentUser } from '../../entities/user';
import { SIGN_OUT_MUTATION } from '../../features/auth/sign-out/api/sign-out.mutation';
import { tokenStore } from '../../shared/lib/token-store';

// ─── Mutations ────────────────────────────────────────────────────────────────

const UPDATE_PROFILE_MUTATION = gql`
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) {
      id
      displayName
      email
      pendingEmail
      createdAt
    }
  }
`;

const CHANGE_PASSWORD_MUTATION = gql`
  mutation ChangePassword($input: ChangePasswordInput!) {
    changePassword(input: $input)
  }
`;

const CHANGE_EMAIL_MUTATION = gql`
  mutation ChangeEmail($newEmail: String!) {
    changeEmail(newEmail: $newEmail)
  }
`;

// ─── Password helpers (mirrors SignUpPage) ────────────────────────────────────

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

// ─── Styles ───────────────────────────────────────────────────────────────────

const requirementItemStyle = (met: boolean): CSSProperties => ({
  fontSize: '0.8rem',
  color: met ? '#10B981' : '#94A3B8',
  display: 'flex',
  alignItems: 'center',
  gap: '0.3rem',
});

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: 10,
  border: '1.5px solid #E2E8F0',
  fontSize: 15,
  color: '#0F172A',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

const labelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: '#374151',
  display: 'block',
  marginBottom: 6,
};

const cardStyle: CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: 16,
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  padding: 24,
  marginBottom: 16,
};

const sectionHeadingStyle: CSSProperties = {
  margin: '0 0 16px',
  fontSize: 15,
  fontWeight: 700,
  color: '#0F172A',
};

const gradientButtonStyle: CSSProperties = {
  width: '100%',
  padding: '14px',
  background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
  color: '#fff',
  fontWeight: 700,
  fontSize: 15,
  borderRadius: 12,
  border: 'none',
  cursor: 'pointer',
};

const gradientButtonDisabledStyle: CSSProperties = {
  opacity: 0.6,
  cursor: 'not-allowed',
};

const styles: Record<string, CSSProperties> = {
  page: {
    backgroundColor: '#F1F5F9',
    minHeight: '100vh',
    paddingBottom: 32,
  },
  topBar: {
    backgroundColor: '#fff',
    boxShadow: '0 1px 0 #E2E8F0',
    padding: '0 20px',
    height: 60,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  topBarLogo: {
    fontSize: 20,
    fontWeight: 800,
    background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  content: {
    maxWidth: 600,
    margin: '0 auto',
    padding: '0 16px',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 9999,
    background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 28,
    fontWeight: 700,
    flexShrink: 0,
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginTop: 12,
  },
  name: {
    margin: 0,
    fontSize: 20,
    fontWeight: 700,
    color: '#0F172A',
  },
  editButton: {
    padding: '4px 12px',
    fontSize: 13,
    fontWeight: 600,
    color: '#7C3AED',
    backgroundColor: 'transparent',
    border: '1px solid #E2E8F0',
    borderRadius: 8,
    cursor: 'pointer',
  },
  nameEditRow: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: '0.5rem',
    marginTop: 12,
  },
  nameEditActions: {
    display: 'flex',
    gap: '0.5rem',
  },
  saveButton: {
    padding: '8px 16px',
    fontSize: 14,
    fontWeight: 700,
    color: '#ffffff',
    background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
  },
  saveButtonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  cancelButton: {
    padding: '8px 16px',
    fontSize: 14,
    fontWeight: 600,
    color: '#475569',
    backgroundColor: '#fff',
    border: '1.5px solid #E2E8F0',
    borderRadius: 8,
    cursor: 'pointer',
  },
  inlineError: {
    fontSize: '0.8rem',
    color: '#EF4444',
  },
  email: {
    margin: '0 0 12px',
    fontSize: 14,
    color: '#475569',
  },
  pending: {
    margin: '0 0 16px',
    padding: '10px 14px',
    backgroundColor: '#EEF2FF',
    border: '1px solid #C7D2FE',
    borderRadius: 10,
    fontSize: 14,
    color: '#4338CA',
  },
  requirementsList: {
    listStyle: 'none',
    margin: '0.4rem 0 0',
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
    marginTop: 4,
  },
  mutationError: {
    padding: '10px 14px',
    backgroundColor: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: 10,
    fontSize: 13,
    color: '#EF4444',
    boxSizing: 'border-box',
  },
  successBox: {
    padding: '10px 14px',
    backgroundColor: '#ECFDF5',
    border: '1px solid #A7F3D0',
    borderRadius: 10,
    fontSize: 13,
    color: '#065F46',
    boxSizing: 'border-box',
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ProfilePage() {
  const { user, loading } = useCurrentUser();
  const navigate = useNavigate();

  // ── sign-out ──
  const [signOut] = useMutation(SIGN_OUT_MUTATION);

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      tokenStore.clear();
      navigate('/sign-in');
    }
  };

  // ── display name editing ──
  const [displayName, setDisplayName] = useState<string>('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [nameEditError, setNameEditError] = useState('');

  const [updateProfile, { loading: updatingProfile }] = useMutation(
    UPDATE_PROFILE_MUTATION,
  );

  const handleEditNameClick = useCallback(() => {
    setEditNameValue(displayName);
    setNameEditError('');
    setIsEditingName(true);
  }, [displayName]);

  const handleCancelNameEdit = useCallback(() => {
    setIsEditingName(false);
    setNameEditError('');
  }, []);

  const handleSaveName = useCallback(async () => {
    const trimmed = editNameValue.trim();
    if (!trimmed || trimmed === displayName) return;

    setNameEditError('');
    try {
      const { data } = await updateProfile({
        variables: { input: { displayName: trimmed } },
      });
      if (data?.updateProfile?.displayName) {
        setDisplayName(data.updateProfile.displayName);
      }
      setIsEditingName(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to update display name';
      setNameEditError(message);
    }
  }, [updateProfile, editNameValue, displayName]);

  const isSaveNameDisabled =
    !editNameValue.trim() ||
    editNameValue.trim() === displayName ||
    updatingProfile;

  // ── change-password ──
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [newPasswordFocused, setNewPasswordFocused] = useState(false);
  const [confirmNewTouched, setConfirmNewTouched] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const [changePassword, { loading: changingPassword }] = useMutation(
    CHANGE_PASSWORD_MUTATION,
  );

  const newPasswordReqs = checkPasswordRequirements(newPassword);
  const showNewPasswordReqs = newPasswordFocused || newPassword.length > 0;
  const passwordsMatch = newPassword === confirmNewPassword;
  const showMismatchError = confirmNewTouched && !passwordsMatch;

  const isChangePasswordValid =
    currentPassword.length > 0 &&
    allRequirementsMet(newPasswordReqs) &&
    passwordsMatch &&
    confirmNewPassword.length > 0;

  const handleChangePassword = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!isChangePasswordValid || changingPassword) return;

      setPasswordError('');
      setPasswordSuccess(false);

      try {
        await changePassword({
          variables: {
            input: {
              currentPassword,
              newPassword,
            },
          },
        });
        setPasswordSuccess(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setConfirmNewTouched(false);
        setNewPasswordFocused(false);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to change password';
        setPasswordError(message);
      }
    },
    [
      changePassword,
      isChangePasswordValid,
      changingPassword,
      currentPassword,
      newPassword,
    ],
  );

  // ── change-email ──
  const [newEmailValue, setNewEmailValue] = useState('');
  const [localPendingEmail, setLocalPendingEmail] = useState<string | null>(
    null,
  );
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [emailError, setEmailError] = useState('');

  const [changeEmail, { loading: changingEmail }] =
    useMutation(CHANGE_EMAIL_MUTATION);

  const handleChangeEmail = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const trimmed = newEmailValue.trim();
      if (!trimmed || changingEmail) return;

      setEmailError('');
      setEmailSuccess(false);

      try {
        await changeEmail({ variables: { newEmail: trimmed } });
        setLocalPendingEmail(trimmed);
        setNewEmailValue('');
        setEmailSuccess(true);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to request email change';
        setEmailError(message);
      }
    },
    [changeEmail, newEmailValue, changingEmail],
  );

  // ─── Early returns ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.topBar}>
          <span style={styles.topBarLogo}>CoinYan</span>
        </div>
        <div style={{ ...styles.content, textAlign: 'center', paddingTop: 40, color: '#94A3B8' }}>
          Loading…
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/sign-in" replace />;
  }

  // Initialise local displayName from user on first render
  const resolvedDisplayName = displayName || user.displayName;
  const initial = resolvedDisplayName.charAt(0).toUpperCase();

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={styles.page}>
      {/* Top bar */}
      <div style={styles.topBar}>
        <span style={styles.topBarLogo}>CoinYan</span>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 14,
            color: '#7C3AED',
            fontWeight: 600,
            padding: 0,
          }}
        >
          ← Home
        </button>
      </div>

      <div style={styles.content}>
        {/* Profile header card */}
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={styles.avatar} aria-hidden="true">
            {initial}
          </div>

          {/* Display name — view / edit mode */}
          {isEditingName ? (
            <div style={styles.nameEditRow}>
              <input
                style={inputStyle}
                type="text"
                autoComplete="name"
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
                aria-label="Display name"
                autoFocus
              />
              {nameEditError && (
                <span style={styles.inlineError} role="alert">
                  {nameEditError}
                </span>
              )}
              <div style={styles.nameEditActions}>
                <button
                  type="button"
                  onClick={handleSaveName}
                  disabled={isSaveNameDisabled}
                  style={{
                    ...styles.saveButton,
                    ...(isSaveNameDisabled ? styles.saveButtonDisabled : {}),
                  }}
                >
                  {updatingProfile ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelNameEdit}
                  style={styles.cancelButton}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={styles.nameRow}>
              <h1 style={styles.name}>{resolvedDisplayName}</h1>
              <button
                type="button"
                onClick={handleEditNameClick}
                style={styles.editButton}
                aria-label="Edit display name"
              >
                Edit
              </button>
            </div>
          )}
        </div>

        {/* Change-password card */}
        <div style={cardStyle}>
          <h2 style={sectionHeadingStyle}>Change Password</h2>
          <form
            onSubmit={handleChangePassword}
            noValidate
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            <div>
              <label style={labelStyle} htmlFor="profile-current-pw">Current password</label>
              <input
                id="profile-current-pw"
                style={inputStyle}
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  setPasswordError('');
                  setPasswordSuccess(false);
                }}
                required
              />
            </div>

            <div>
              <label style={labelStyle} htmlFor="profile-new-pw">New password</label>
              <input
                id="profile-new-pw"
                style={inputStyle}
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onFocus={() => setNewPasswordFocused(true)}
                onBlur={() => setNewPasswordFocused(false)}
                required
              />
              {showNewPasswordReqs && (
                <ul style={styles.requirementsList}>
                  <li style={requirementItemStyle(newPasswordReqs.minLength)}>
                    {newPasswordReqs.minLength ? '✓' : '✗'} At least 8 characters
                  </li>
                  <li style={requirementItemStyle(newPasswordReqs.hasUppercase)}>
                    {newPasswordReqs.hasUppercase ? '✓' : '✗'} At least one uppercase letter
                  </li>
                  <li style={requirementItemStyle(newPasswordReqs.hasNumber)}>
                    {newPasswordReqs.hasNumber ? '✓' : '✗'} At least one number
                  </li>
                </ul>
              )}
            </div>

            <div>
              <label style={labelStyle} htmlFor="profile-confirm-pw">Confirm new password</label>
              <input
                id="profile-confirm-pw"
                style={{
                  ...inputStyle,
                  ...(showMismatchError ? styles.inputError : {}),
                }}
                type="password"
                autoComplete="new-password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                onBlur={() => setConfirmNewTouched(true)}
                required
              />
              {showMismatchError && (
                <span style={styles.errorText}>Passwords do not match</span>
              )}
            </div>

            <button
              type="submit"
              disabled={!isChangePasswordValid || changingPassword}
              style={{
                ...gradientButtonStyle,
                ...(!isChangePasswordValid || changingPassword ? gradientButtonDisabledStyle : {}),
              }}
            >
              {changingPassword ? 'Updating…' : 'Update password'}
            </button>

            {passwordError && (
              <div style={styles.mutationError} role="alert">
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div style={styles.successBox} role="status">
                Password updated successfully
              </div>
            )}
          </form>
        </div>

        {/* Change-email card */}
        <div style={cardStyle}>
          <h2 style={sectionHeadingStyle}>Email Address</h2>
          <p style={styles.email}>{user.email}</p>

          {(localPendingEmail ?? user.pendingEmail) && (
            <p style={styles.pending} role="status">
              A confirmation link has been sent to{' '}
              {localPendingEmail ?? user.pendingEmail}. Click it to complete the change.
            </p>
          )}

          <form
            onSubmit={handleChangeEmail}
            noValidate
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            <div>
              <label style={labelStyle} htmlFor="profile-new-email">New email address</label>
              <input
                id="profile-new-email"
                style={inputStyle}
                type="email"
                autoComplete="email"
                value={newEmailValue}
                onChange={(e) => {
                  setNewEmailValue(e.target.value);
                  setEmailError('');
                  setEmailSuccess(false);
                }}
                required
              />
            </div>

            <button
              type="submit"
              disabled={!newEmailValue.trim() || changingEmail}
              style={{
                ...gradientButtonStyle,
                ...(!newEmailValue.trim() || changingEmail ? gradientButtonDisabledStyle : {}),
              }}
            >
              {changingEmail ? 'Sending…' : 'Change email'}
            </button>

            {emailError && (
              <div style={styles.mutationError} role="alert">
                {emailError}
              </div>
            )}

            {emailSuccess && (
              <div style={styles.successBox} role="status">
                Confirmation link sent. Check your inbox.
              </div>
            )}
          </form>
        </div>

        {/* Sign out card */}
        <div style={cardStyle}>
          <button
            type="button"
            onClick={handleSignOut}
            style={{
              background: 'none',
              border: '1.5px solid #EF4444',
              borderRadius: 10,
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: 600,
              color: '#EF4444',
              padding: '12px 20px',
              width: '100%',
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
