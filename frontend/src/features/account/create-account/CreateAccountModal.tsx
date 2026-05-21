import { useState } from 'react';
import { gql, useMutation } from '@apollo/client';
import { ACCOUNTS_QUERY } from '../../../entities/account';
import { ACCOUNT_ICONS, ICON_KEYS } from '../../../shared/lib/account-icons';
import { CURRENCIES } from '../../../shared/lib/currencies';

const CREATE_ACCOUNT_MUTATION = gql`
  mutation CreateAccount($input: CreateAccountInput!) {
    createAccount(input: $input) {
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
  onClose: () => void;
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

export function CreateAccountModal({ onClose }: Props) {
  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('cash');
  const [currencySearch, setCurrencySearch] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [startingBalance, setStartingBalance] = useState('');
  const [nameError, setNameError] = useState('');
  const [currencyError, setCurrencyError] = useState('');
  const [serverError, setServerError] = useState('');

  const [createAccount, { loading }] = useMutation(CREATE_ACCOUNT_MUTATION, {
    refetchQueries: [{ query: ACCOUNTS_QUERY }],
  });

  const filteredCurrencies = CURRENCIES.filter(
    (c) =>
      c.code.includes(currencySearch.toUpperCase()) ||
      c.name.toLowerCase().includes(currencySearch.toLowerCase()),
  ).slice(0, 8);

  const handleSubmit = async () => {
    setNameError('');
    setCurrencyError('');
    setServerError('');
    let valid = true;
    if (!name.trim()) {
      setNameError('Name is required');
      valid = false;
    }
    if (!selectedCurrency) {
      setCurrencyError('Currency is required');
      valid = false;
    }
    if (!valid) return;

    try {
      await createAccount({
        variables: {
          input: {
            name: name.trim(),
            icon: selectedIcon,
            currency: selectedCurrency,
            startingBalance: startingBalance ? parseFloat(startingBalance) : null,
          },
        },
      });
      onClose();
    } catch (e: unknown) {
      setServerError(e instanceof Error ? e.message : 'Failed to create account');
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
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0F172A' }}>Add account</h2>

        {/* Name */}
        <div>
          <label style={labelStyle}>Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Main Card"
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

        {/* Currency search */}
        <div style={{ position: 'relative' }}>
          <label style={labelStyle}>Currency</label>
          <input
            value={
              selectedCurrency
                ? `${selectedCurrency} — ${CURRENCIES.find((c) => c.code === selectedCurrency)?.name ?? ''}`
                : currencySearch
            }
            onChange={(e) => {
              setSelectedCurrency('');
              setCurrencySearch(e.target.value);
              setShowCurrencyDropdown(true);
            }}
            onFocus={() => {
              if (!selectedCurrency) setShowCurrencyDropdown(true);
            }}
            placeholder="Search currency..."
            style={inputStyle}
          />
          {currencyError && (
            <p style={{ color: '#EF4444', fontSize: 13, margin: '4px 0 0' }}>{currencyError}</p>
          )}
          {showCurrencyDropdown && !selectedCurrency && filteredCurrencies.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                backgroundColor: '#fff',
                border: '1.5px solid #E2E8F0',
                borderRadius: 10,
                maxHeight: 160,
                overflowY: 'auto',
                zIndex: 200,
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
              }}
            >
              {filteredCurrencies.map((c) => (
                <div
                  key={c.code}
                  onClick={() => {
                    setSelectedCurrency(c.code);
                    setCurrencySearch('');
                    setShowCurrencyDropdown(false);
                  }}
                  style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: '#0F172A' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
                >
                  <strong>{c.code}</strong> — {c.name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Starting balance */}
        <div>
          <label style={labelStyle}>
            Starting balance{' '}
            <span style={{ fontWeight: 400, color: '#94A3B8' }}>(optional)</span>
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={startingBalance}
            onChange={(e) => setStartingBalance(e.target.value)}
            placeholder="0.00"
            style={inputStyle}
          />
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
