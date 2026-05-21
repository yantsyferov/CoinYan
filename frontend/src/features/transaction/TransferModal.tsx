import { useState } from 'react';
import { useMutation } from '@apollo/client';
import type { Account } from '../../entities/account';
import { CREATE_TRANSFER_TRANSACTION_MUTATION } from '../../entities/transaction/api/transactions.mutations';
import { ACCOUNT_TRANSACTIONS_QUERY } from '../../entities/transaction/api/transactions.queries';
import { ACCOUNTS_QUERY } from '../../entities/account/api/accounts.query';

interface Props {
  fromAccount: Account;
  toAccount: Account;
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

export function TransferModal({ fromAccount, toAccount, onClose }: Props) {
  const [amount, setAmount] = useState('');
  const [exchangeRate, setExchangeRate] = useState('1');
  const [note, setNote] = useState('');
  const [amountError, setAmountError] = useState('');

  const isCrossCurrency = fromAccount.currency !== toAccount.currency;
  const parsedAmount = parseFloat(amount);
  const parsedRate = parseFloat(exchangeRate) || 1;
  const toAmount = isCrossCurrency ? (parsedAmount * parsedRate).toFixed(2) : null;
  const isValid = !isNaN(parsedAmount) && parsedAmount > 0;

  const [createTransfer, { loading, error }] = useMutation(
    CREATE_TRANSFER_TRANSACTION_MUTATION,
    {
      refetchQueries: [
        ACCOUNTS_QUERY,
        { query: ACCOUNT_TRANSACTIONS_QUERY, variables: { accountId: fromAccount.id } },
        { query: ACCOUNT_TRANSACTIONS_QUERY, variables: { accountId: toAccount.id } },
      ],
    },
  );

  const handleAmountBlur = () => {
    if (!amount || parseFloat(amount) <= 0) {
      setAmountError('Amount is required');
    } else {
      setAmountError('');
    }
  };

  const handleConfirm = async () => {
    await createTransfer({
      variables: {
        input: {
          fromAccountId: fromAccount.id,
          toAccountId: toAccount.id,
          fromAmount: parsedAmount,
          toAmount: isCrossCurrency ? parseFloat(toAmount!) : parsedAmount,
          fromCurrency: fromAccount.currency,
          toCurrency: toAccount.currency,
          exchangeRate: isCrossCurrency ? parsedRate : 1.0,
          note: note || null,
        },
      },
      onCompleted: () => onClose(),
    });
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
      {/* Modal */}
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
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0F172A' }}>Transfer</h2>

        {/* From → To pill */}
        <div
          style={{
            background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
            borderRadius: 9999,
            padding: '10px 20px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            alignSelf: 'flex-start',
          }}
        >
          <span>{fromAccount.name}</span>
          <span>→</span>
          <span>{toAccount.name}</span>
        </div>

        {/* Amount */}
        <div>
          <label style={labelStyle}>
            Amount ({fromAccount.currency})
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setAmountError(''); }}
            onBlur={handleAmountBlur}
            placeholder="0.00"
            style={{
              ...inputStyle,
              border: `1.5px solid ${amountError ? '#EF4444' : '#E2E8F0'}`,
            }}
          />
          {amountError && (
            <p style={{ color: '#EF4444', fontSize: 13, margin: '4px 0 0' }}>{amountError}</p>
          )}
        </div>

        {/* Cross-currency: exchange rate + preview */}
        {isCrossCurrency && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <label style={labelStyle}>Exchange rate</label>
              <input
                type="number"
                min="0"
                step="0.0001"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
                style={inputStyle}
              />
            </div>
            {isValid && (
              <div
                style={{
                  background: '#ECFDF5',
                  borderRadius: 10,
                  padding: '10px 14px',
                  fontSize: 13,
                  color: '#065F46',
                  fontWeight: 500,
                }}
              >
                ≈ {toAmount} {toAccount.currency} will be credited
              </div>
            )}
          </div>
        )}

        {/* Note */}
        <div>
          <label style={labelStyle}>Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Monthly savings"
            style={inputStyle}
          />
        </div>

        {/* Mutation error */}
        {error && (
          <p style={{ color: '#EF4444', fontSize: 13, margin: 0 }}>
            {error.message}
          </p>
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
            onClick={handleConfirm}
            disabled={!isValid || loading}
            style={{
              background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '12px 20px',
              fontWeight: 600,
              fontSize: 15,
              cursor: isValid && !loading ? 'pointer' : 'not-allowed',
              opacity: isValid && !loading ? 1 : 0.5,
            }}
          >
            {loading ? 'Confirming…' : 'Confirm'}
          </button>
        </div>
      </div>
    </>
  );
}
