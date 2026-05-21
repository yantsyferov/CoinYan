import { useState } from 'react';
import { useMutation } from '@apollo/client';
import type { DocumentNode } from '@apollo/client';
import { ACCOUNT_ICONS, ICON_KEYS } from '../../../shared/lib/account-icons';

interface Props {
  onClose: () => void;
  mutationDocument: DocumentNode;
  refetchQuery: DocumentNode;
  title: string;
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

export function CreateCategoryModal({ onClose, mutationDocument, refetchQuery, title }: Props) {
  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(ICON_KEYS[0]);
  const [nameError, setNameError] = useState('');
  const [serverError, setServerError] = useState('');

  const [createCategory, { loading }] = useMutation(mutationDocument, {
    refetchQueries: [{ query: refetchQuery }],
  });

  const handleSubmit = async () => {
    setNameError('');
    setServerError('');

    if (!name.trim()) {
      setNameError('Name is required');
      return;
    }

    try {
      await createCategory({
        variables: {
          input: {
            name: name.trim(),
            icon: selectedIcon,
          },
        },
      });
      onClose();
    } catch (e: unknown) {
      setServerError(e instanceof Error ? e.message : 'Failed to create category');
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
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0F172A' }}>{title}</h2>

        {/* Name */}
        <div>
          <label style={labelStyle}>Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Groceries"
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
            onClick={handleSubmit}
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
      </div>
    </>
  );
}
