import { useState } from 'react';
import { gql, useMutation } from '@apollo/client';
import { ACCOUNT_ICONS, ICON_KEYS } from '../../../shared/lib/account-icons';
import { ACCOUNTS_QUERY } from '../../../entities/account';
import { DeleteAccountMenu } from '../delete-account';
import type { Account } from '../../../entities/account';

const UPDATE_ACCOUNT_MUTATION = gql`
  mutation UpdateAccount($id: ID!, $input: UpdateAccountInput!) {
    updateAccount(id: $id, input: $input) {
      id
      name
      icon
      currency
      currentBalance
      status
      createdAt
    }
  }
`;

interface Props {
  account: Account;
  onClose: () => void;
  onDeleted?: () => void;
}

const inputStyle: React.CSSProperties = {
  display: 'block',
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

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: '#374151',
  display: 'block',
  marginBottom: 6,
};

export function EditAccountModal({ account, onClose, onDeleted }: Props) {
  const [name, setName] = useState(account.name);
  const [selectedIcon, setSelectedIcon] = useState(account.icon);
  const [nameError, setNameError] = useState('');
  const [serverError, setServerError] = useState('');
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);

  const [updateAccount, { loading }] = useMutation(UPDATE_ACCOUNT_MUTATION, {
    refetchQueries: [{ query: ACCOUNTS_QUERY }],
  });

  const handleSave = async () => {
    setNameError('');
    setServerError('');
    if (!name.trim()) {
      setNameError('Name is required');
      return;
    }
    try {
      await updateAccount({
        variables: { id: account.id, input: { name: name.trim(), icon: selectedIcon } },
      });
      onClose();
    } catch (e: unknown) {
      setServerError(e instanceof Error ? e.message : 'Failed to update account');
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15,23,42,0.6)',
          zIndex: 100,
        }}
      />

      {/* Modal card */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          backgroundColor: '#fff',
          borderRadius: 24,
          padding: 32,
          width: 380,
          zIndex: 101,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
        }}
      >
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0F172A' }}>Edit account</h2>

        {/* Name */}
        <div>
          <label style={labelStyle}>Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
          {nameError && (
            <p style={{ color: '#EF4444', fontSize: 13, margin: '4px 0 0' }}>{nameError}</p>
          )}
        </div>

        {/* Icon picker */}
        <div>
          <label style={labelStyle}>Icon</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            {ICON_KEYS.map((key) => (
              <div
                key={key}
                onClick={() => setSelectedIcon(key)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 9999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  cursor: 'pointer',
                  backgroundColor: selectedIcon === key ? '#4F46E5' : '#F8FAFC',
                  border: selectedIcon === key ? '2px solid #3730A3' : '2px solid #E2E8F0',
                  transition: 'background-color 0.15s, border-color 0.15s',
                }}
              >
                {ACCOUNT_ICONS[key]}
              </div>
            ))}
          </div>
        </div>

        {/* Currency — read-only */}
        <div>
          <label style={labelStyle}>Currency</label>
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 10,
              border: '1.5px solid #E2E8F0',
              backgroundColor: '#F8FAFC',
              color: '#94A3B8',
              fontSize: 15,
            }}
          >
            {account.currency}
          </div>
          <p style={{ fontSize: 11, color: '#94A3B8', margin: '4px 0 0' }}>
            Currency cannot be changed after creation
          </p>
        </div>

        {serverError && (
          <p style={{ color: '#EF4444', fontSize: 13, margin: 0 }}>{serverError}</p>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              border: '1.5px solid #E2E8F0',
              backgroundColor: '#fff',
              color: '#475569',
              borderRadius: 10,
              padding: '12px 20px',
              fontWeight: 600,
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            style={{
              background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '12px 20px',
              fontWeight: 600,
              fontSize: 15,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>

        {/* Delete */}
        <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 12 }}>
          <button
            onClick={() => setShowDeleteMenu(true)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              color: '#EF4444',
              padding: 0,
              fontWeight: 600,
            }}
          >
            Delete account
          </button>
        </div>
      </div>

      {showDeleteMenu && (
        <DeleteAccountMenu
          account={account}
          onClose={() => {
            setShowDeleteMenu(false);
            onClose();
            onDeleted?.();
          }}
        />
      )}
    </>
  );
}
