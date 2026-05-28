import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@apollo/client';
import { ACCOUNTS_QUERY } from '../../entities/account';
import { EXPENSE_CATEGORIES_QUERY, INCOME_SOURCES_QUERY } from '../../entities/category';
import {
  CREATE_EXPENSE_TRANSACTION_MUTATION,
  CREATE_INCOME_TRANSACTION_MUTATION,
} from '../../entities/transaction';
import { useExchangeRate } from '../../entities/rate';

interface Props {
  type: 'expense' | 'income';
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  accountCurrency: string;
  fromCurrency?: string;
  toCurrency?: string;
  toMonthlyLimit?: number | null;
  toMonthlySpent?: number;
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

export function TransactionModal({
  type,
  fromId,
  fromName,
  toId,
  toName,
  accountCurrency: _accountCurrency,
  fromCurrency = 'USD',
  toCurrency = 'USD',
  toMonthlyLimit,
  toMonthlySpent,
  onClose,
}: Props) {
  // ── Cross-currency detection (expense and income) ───────────────────────────
  const isCrossCurrency = fromCurrency !== toCurrency;

  // ── Three-field state (cross-currency expense) ──────────────────────────────
  const [sourceAmount, setSourceAmount] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [rateIsCustom, setRateIsCustom] = useState(false);
  const [lastEdited, setLastEdited] = useState<'source' | 'rate' | 'target'>('source');

  // ── Single-amount state (income, or same-currency expense) ──────────────────
  const [amount, setAmount] = useState('');

  const [note, setNote] = useState('');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [amountError, setAmountError] = useState('');
  const [serverError, setServerError] = useState('');
  const [budgetWarning, setBudgetWarning] = useState(false);

  // ── Exchange rate from GraphQL (cross-currency) ──────────────────────────────
  const { rate: suggestedRate, stale: rateIsStale } = useExchangeRate(
    isCrossCurrency ? fromCurrency : '',
    isCrossCurrency ? toCurrency : '',
    date,
  );

  // Track whether the user has changed the date after modal open
  const dateChangedRef = useRef(false);

  // Pending suggested rate for the inline banner
  const [pendingSuggestedRate, setPendingSuggestedRate] = useState<number | null>(null);

  // Pre-fill exchange rate when API returns it (only if user has not set a custom rate)
  useEffect(() => {
    if (!isCrossCurrency) return;
    if (suggestedRate !== null && !rateIsCustom) {
      setExchangeRate(suggestedRate.toFixed(4));
    }
  }, [suggestedRate, isCrossCurrency, rateIsCustom]);

  // Show suggestion banner when date changes and new rate differs from current rate field
  useEffect(() => {
    if (!isCrossCurrency) return;
    if (!dateChangedRef.current) return;
    if (suggestedRate === null) return;
    const currentRate = parseFloat(exchangeRate);
    if (!isNaN(currentRate) && Math.abs(suggestedRate - currentRate) > 0.00001) {
      setPendingSuggestedRate(suggestedRate);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedRate, date]);

  // ── Reactive cross-field calculations ───────────────────────────────────────
  useEffect(() => {
    if (!isCrossCurrency) return;
    const src = parseFloat(sourceAmount);
    const rate = parseFloat(exchangeRate);
    const tgt = parseFloat(targetAmount);

    if (lastEdited === 'source' || lastEdited === 'rate') {
      if (!isNaN(src) && !isNaN(rate)) {
        setTargetAmount((src * rate).toFixed(2));
      }
    } else if (lastEdited === 'target') {
      if (!isNaN(tgt) && !isNaN(src) && src > 0) {
        setExchangeRate((tgt / src).toFixed(4));
        setRateIsCustom(true);
      }
    }
  }, [lastEdited, sourceAmount, exchangeRate, targetAmount, isCrossCurrency]);

  const parsedAmount = parseFloat(amount);

  // ── Apollo mutations ────────────────────────────────────────────────────────
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

  // ── Validation helpers ──────────────────────────────────────────────────────
  const crossCurrencyFormIncomplete =
    (type === 'expense' || type === 'income') &&
    isCrossCurrency &&
    (!sourceAmount ||
      parseFloat(sourceAmount) <= 0 ||
      !exchangeRate ||
      parseFloat(exchangeRate) <= 0 ||
      !targetAmount ||
      parseFloat(targetAmount) <= 0);

  // ── Submit handler ──────────────────────────────────────────────────────────
  const handleConfirm = async () => {
    setAmountError('');
    setServerError('');

    if (type === 'expense' && isCrossCurrency) {
      const src = parseFloat(sourceAmount);
      const rate = parseFloat(exchangeRate);
      const tgt = parseFloat(targetAmount);

      if (isNaN(src) || src <= 0) {
        setAmountError(`Amount (${fromCurrency}) must be greater than 0`);
        return;
      }
      if (isNaN(rate) || rate <= 0) {
        setAmountError('Exchange rate must be greater than 0');
        return;
      }
      if (isNaN(tgt) || tgt <= 0) {
        setAmountError(`Total (${toCurrency}) must be greater than 0`);
        return;
      }

      // Budget gate
      if (
        toMonthlyLimit != null &&
        toMonthlyLimit > 0 &&
        toMonthlySpent !== undefined &&
        !budgetWarning
      ) {
        if (toMonthlySpent + tgt > toMonthlyLimit) {
          setBudgetWarning(true);
          return;
        }
      }

      try {
        await createExpense({
          variables: {
            input: {
              accountId: fromId,
              expenseCategoryId: toId,
              // amount = category display amount (in toCurrency / category currency)
              amount: tgt,
              // accountAmount = what leaves the account (in fromCurrency / account currency)
              accountAmount: src,
              accountCurrency: fromCurrency,
              exchangeRate: rate,
              note: note.trim() || null,
              transactionDate: date,
            },
          },
        });
        onClose();
      } catch (e: unknown) {
        setServerError(e instanceof Error ? e.message : 'Failed to create transaction');
      }
      return;
    }

    // ── Single-currency expense ───────────────────────────────────────────────
    if (type === 'expense' && !isCrossCurrency) {
      if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
        setAmountError('Amount must be greater than 0');
        return;
      }

      if (
        toMonthlyLimit != null &&
        toMonthlyLimit > 0 &&
        toMonthlySpent !== undefined &&
        !budgetWarning
      ) {
        if (toMonthlySpent + parsedAmount > toMonthlyLimit) {
          setBudgetWarning(true);
          return;
        }
      }

      try {
        await createExpense({
          variables: {
            input: {
              accountId: fromId,
              expenseCategoryId: toId,
              amount: parsedAmount,
              accountAmount: parsedAmount,
              accountCurrency: fromCurrency,
              exchangeRate: 1,
              note: note.trim() || null,
              transactionDate: date,
            },
          },
        });
        onClose();
      } catch (e: unknown) {
        setServerError(e instanceof Error ? e.message : 'Failed to create transaction');
      }
      return;
    }

    // ── Income (cross-currency) ───────────────────────────────────────────────
    if (type === 'income' && isCrossCurrency) {
      const src = parseFloat(sourceAmount);
      const rate = parseFloat(exchangeRate);
      const tgt = parseFloat(targetAmount);

      if (isNaN(src) || src <= 0) {
        setAmountError(`Amount (${fromCurrency}) must be greater than 0`);
        return;
      }
      if (isNaN(rate) || rate <= 0) {
        setAmountError('Exchange rate must be greater than 0');
        return;
      }
      if (isNaN(tgt) || tgt <= 0) {
        setAmountError(`Total (${toCurrency}) must be greater than 0`);
        return;
      }

      try {
        await createIncome({
          variables: {
            input: {
              incomeSourceId: fromId,
              accountId: toId,
              amount: src,
              accountAmount: tgt,
              accountCurrency: toCurrency,
              sourceCurrency: fromCurrency,
              targetCurrency: toCurrency,
              exchangeRate: rate,
              rateIsCustom,
              note: note.trim() || null,
              transactionDate: date,
            },
          },
        });
        onClose();
      } catch (e: unknown) {
        setServerError(e instanceof Error ? e.message : 'Failed to create transaction');
      }
      return;
    }

    // ── Income (same currency) ────────────────────────────────────────────────
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setAmountError('Amount must be greater than 0');
      return;
    }

    try {
      await createIncome({
        variables: {
          input: {
            incomeSourceId: fromId,
            accountId: toId,
            amount: parsedAmount,
            accountAmount: parsedAmount,
            accountCurrency: toCurrency,
            sourceCurrency: fromCurrency,
            targetCurrency: toCurrency,
            exchangeRate: 1,
            rateIsCustom: false,
            note: note.trim() || null,
            transactionDate: date,
          },
        },
      });
      onClose();
    } catch (e: unknown) {
      setServerError(e instanceof Error ? e.message : 'Failed to create transaction');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
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
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0F172A' }}>
          New Transaction
        </h2>

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

        {/* ── Cross-currency (expense or income): three-field form ── */}
        {isCrossCurrency ? (
          <>
            {/* Source amount */}
            <div>
              <label style={labelStyle}>Amount ({fromCurrency})</label>
              <input
                type="number"
                value={sourceAmount}
                onChange={(e) => {
                  setLastEdited('source');
                  setSourceAmount(e.target.value);
                }}
                placeholder="0.00"
                min="0.01"
                step="0.01"
                style={{
                  ...inputStyle,
                  border: `1.5px solid ${amountError ? '#EF4444' : '#E2E8F0'}`,
                }}
              />
            </div>

            {/* Exchange rate */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Exchange Rate</label>
                {rateIsCustom && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#7C3AED',
                      background: '#EDE9FE',
                      borderRadius: 4,
                      padding: '2px 6px',
                      letterSpacing: '0.03em',
                    }}
                  >
                    Custom
                  </span>
                )}
              </div>
              <input
                type="number"
                value={exchangeRate}
                onChange={(e) => {
                  setLastEdited('rate');
                  setRateIsCustom(true);
                  setExchangeRate(e.target.value);
                }}
                placeholder="0.0000"
                min="0.0001"
                step="0.0001"
                style={inputStyle}
              />
              <p
                style={{
                  fontSize: 12,
                  color: '#94A3B8',
                  margin: '4px 0 0',
                }}
              >
                1 {fromCurrency} = {exchangeRate || '?'} {toCurrency}
              </p>
              {rateIsStale && !rateIsCustom && (
                <p
                  style={{
                    fontSize: 12,
                    color: '#D97706',
                    margin: '4px 0 0',
                    fontWeight: 500,
                  }}
                >
                  ⚠ Rate may be outdated
                </p>
              )}
              {rateIsCustom && (
                <button
                  type="button"
                  onClick={() => {
                    if (suggestedRate !== null) {
                      setExchangeRate(suggestedRate.toFixed(4));
                    }
                    setRateIsCustom(false);
                    setLastEdited('rate');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    marginTop: 4,
                    fontSize: 12,
                    color: '#4F46E5',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Reset to suggested rate
                </button>
              )}
            </div>

            {/* Target amount */}
            <div>
              <label style={labelStyle}>Total ({toCurrency})</label>
              <input
                type="number"
                value={targetAmount}
                onChange={(e) => {
                  setLastEdited('target');
                  setTargetAmount(e.target.value);
                }}
                placeholder="0.00"
                min="0.01"
                step="0.01"
                style={{
                  ...inputStyle,
                  border: `1.5px solid ${amountError ? '#EF4444' : '#E2E8F0'}`,
                }}
              />
            </div>

            {amountError && (
              <p style={{ color: '#EF4444', fontSize: 13, margin: 0 }}>{amountError}</p>
            )}

            {/* Historical rate suggestion banner */}
            {pendingSuggestedRate !== null && (
              <div
                style={{
                  background: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  borderRadius: 10,
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <p style={{ margin: 0, fontSize: 13, color: '#1E40AF', fontWeight: 500 }}>
                  Historical rate for {date}: {pendingSuggestedRate.toFixed(4)}. Apply it?
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setExchangeRate(pendingSuggestedRate.toFixed(4));
                      setRateIsCustom(false);
                      setLastEdited('rate');
                      setPendingSuggestedRate(null);
                    }}
                    style={{
                      background: '#2563EB',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '6px 14px',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingSuggestedRate(null)}
                    style={{
                      background: 'none',
                      border: '1px solid #BFDBFE',
                      borderRadius: 6,
                      padding: '6px 14px',
                      fontWeight: 600,
                      fontSize: 13,
                      color: '#1E40AF',
                      cursor: 'pointer',
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* ── Single-currency (expense or income): one amount field ── */
          <div>
            <label style={labelStyle}>Amount</label>
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
        )}

        {/* Date */}
        <div>
          <label style={labelStyle}>Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => {
              dateChangedRef.current = true;
              setPendingSuggestedRate(null);
              setDate(e.target.value);
            }}
            max={new Date().toISOString().slice(0, 10)}
            style={inputStyle}
          />
        </div>

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

        {budgetWarning ? (
          <div
            style={{
              background: '#FEF2F2',
              borderRadius: 12,
              padding: '14px 16px',
              border: '1px solid #FECACA',
            }}
          >
            <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: '#991B1B' }}>
              Over budget
            </p>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: '#7F1D1D' }}>
              This expense will exceed the monthly limit for this category.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setBudgetWarning(false)}
                disabled={loading}
                style={{
                  border: '1.5px solid #FECACA',
                  backgroundColor: '#fff',
                  color: '#991B1B',
                  borderRadius: 10,
                  padding: '10px 16px',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                style={{
                  background: '#EF4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '10px 16px',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.5 : 1,
                }}
              >
                {loading ? 'Saving...' : 'Confirm anyway'}
              </button>
            </div>
          </div>
        ) : (
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
              disabled={loading || crossCurrencyFormIncomplete}
              style={{
                background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                padding: '12px 20px',
                fontWeight: 600,
                fontSize: 15,
                cursor: loading || crossCurrencyFormIncomplete ? 'not-allowed' : 'pointer',
                opacity: loading || crossCurrencyFormIncomplete ? 0.5 : 1,
              }}
            >
              {loading ? 'Saving...' : 'Confirm'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
