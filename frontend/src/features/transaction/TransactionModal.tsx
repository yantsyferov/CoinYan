import { useEffect, useState } from 'react';
import { useMutation } from '@apollo/client';
import { ACCOUNTS_QUERY } from '../../entities/account';
import { EXPENSE_CATEGORIES_QUERY, INCOME_SOURCES_QUERY } from '../../entities/category';
import {
  CREATE_EXPENSE_TRANSACTION_MUTATION,
  CREATE_INCOME_TRANSACTION_MUTATION,
} from '../../entities/transaction';
import { formatCurrency } from '../../shared/lib/format-currency';

interface Props {
  type: 'expense' | 'income';
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  accountCurrency: string;
  onClose: () => void;
}

const BASE_CURRENCY = 'USD';

async function fetchRate(from: string, to: string): Promise<number> {
  const res = await fetch(`/bff/exchange-rate?from=${from}&to=${to}`);
  if (!res.ok) throw new Error('rate unavailable');
  const data = await res.json();
  return data.rate as number;
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

export function TransactionModal({
  type,
  fromId,
  fromName,
  toId,
  toName,
  accountCurrency,
  onClose,
}: Props) {
  const needsConversion = accountCurrency !== BASE_CURRENCY;

  // For expense: user enters account-currency amount, we convert to USD for category
  // For income: user enters USD amount (income source), we convert to account-currency for balance
  const inputCurrency = type === 'expense' ? accountCurrency : BASE_CURRENCY;
  const outputCurrency = type === 'expense' ? BASE_CURRENCY : accountCurrency;

  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState('');
  const [rateLoading, setRateLoading] = useState(false);
  const [note, setNote] = useState('');
  const [amountError, setAmountError] = useState('');
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    if (!needsConversion) return;
    setRateLoading(true);
    fetchRate(inputCurrency, outputCurrency)
      .then((r) => setRate(r.toFixed(6)))
      .catch(() => setRate(''))
      .finally(() => setRateLoading(false));
  }, [needsConversion, inputCurrency, outputCurrency]);

  const parsedAmount = parseFloat(amount);
  const parsedRate = parseFloat(rate) || 1;
  const convertedAmount = needsConversion ? parsedAmount * parsedRate : parsedAmount;

  const refetchQueries = [
    { query: ACCOUNTS_QUERY },
    { query: EXPENSE_CATEGORIES_QUERY },
    { query: INCOME_SOURCES_QUERY },
  ];

  const [createExpense, { loading: loadingExpense }] = useMutation(
    CREATE_EXPENSE_TRANSACTION_MUTATION,
    { refetchQueries },
  );
  const [createIncome, { loading: loadingIncome }] = useMutation(
    CREATE_INCOME_TRANSACTION_MUTATION,
    { refetchQueries },
  );

  const loading = loadingExpense || loadingIncome;

  const handleConfirm = async () => {
    setAmountError('');
    setServerError('');

    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setAmountError('Amount must be greater than 0');
      return;
    }
    if (needsConversion && (!rate || parsedRate <= 0)) {
      setAmountError('Enter a valid exchange rate');
      return;
    }

    try {
      if (type === 'expense') {
        // account_amount = what leaves the account (in account currency)
        // amount = display amount for category (in USD)
        await createExpense({
          variables: {
            input: {
              accountId: fromId,
              expenseCategoryId: toId,
              amount: needsConversion ? convertedAmount : parsedAmount,
              accountAmount: parsedAmount,
              accountCurrency,
              exchangeRate: parsedRate,
              note: note.trim() || null,
            },
          },
        });
      } else {
        // amount = income source display amount (in USD)
        // account_amount = what goes into account (in account currency)
        await createIncome({
          variables: {
            input: {
              incomeSourceId: fromId,
              accountId: toId,
              amount: parsedAmount,
              accountAmount: needsConversion ? convertedAmount : parsedAmount,
              accountCurrency,
              exchangeRate: parsedRate,
              note: note.trim() || null,
            },
          },
        });
      }
      onClose();
    } catch (e: unknown) {
      setServerError(e instanceof Error ? e.message : 'Failed to create transaction');
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15,23,42,0.6)',
          zIndex: 100,
        }}
      />

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
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0F172A' }}>New Transaction</h2>

        {/* Summary pill */}
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
          <span>{fromName}</span>
          <span>→</span>
          <span>{toName}</span>
        </div>

        {/* Amount */}
        <div>
          <label style={labelStyle}>
            Amount{needsConversion ? ` (${inputCurrency})` : ''}
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min="0.01"
            step="0.01"
            style={{
              ...inputStyle,
              border: `1.5px solid ${amountError ? '#EF4444' : '#E2E8F0'}`,
            }}
          />
          {amountError && (
            <p style={{ color: '#EF4444', fontSize: 13, margin: '4px 0 0' }}>{amountError}</p>
          )}
        </div>

        {/* Exchange rate — only when currencies differ */}
        {needsConversion && (
          <div>
            <label style={labelStyle}>
              Exchange rate ({inputCurrency} → {outputCurrency})
            </label>
            <input
              type="number"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder={rateLoading ? 'Loading...' : '1.000000'}
              min="0.000001"
              step="0.000001"
              disabled={rateLoading}
              style={{
                ...inputStyle,
                color: rateLoading ? '#94A3B8' : '#0F172A',
              }}
            />

            {amount && !isNaN(parsedAmount) && parsedAmount > 0 && parsedRate > 0 && (
              <div
                style={{
                  background: '#ECFDF5',
                  borderRadius: 10,
                  padding: '10px 14px',
                  fontSize: 13,
                  color: '#065F46',
                  fontWeight: 500,
                  marginTop: 8,
                }}
              >
                ≈ {formatCurrency(convertedAmount, outputCurrency === BASE_CURRENCY ? 'USD' : outputCurrency)}
              </div>
            )}
          </div>
        )}

        {/* Note */}
        <div>
          <label style={labelStyle}>Note</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            style={inputStyle}
          />
        </div>

        {serverError && (
          <p style={{ color: '#EF4444', fontSize: 13, margin: 0 }}>{serverError}</p>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={loading}
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
            {loading ? 'Saving...' : 'Confirm'}
          </button>
        </div>
      </div>
    </>
  );
}
