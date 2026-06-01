import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@apollo/client';
import {
  UPDATE_TRANSACTION_MUTATION,
  ACCOUNT_TRANSACTIONS_QUERY,
  EXPENSE_CATEGORY_TRANSACTIONS_QUERY,
  INCOME_SOURCE_TRANSACTIONS_QUERY,
} from '../../entities/transaction';
import { ACCOUNTS_QUERY } from '../../entities/account';
import { EXPENSE_CATEGORIES_QUERY, INCOME_SOURCES_QUERY } from '../../entities/category';
import { useExchangeRate } from '../../entities/rate';
import type { Transaction } from '../../entities/transaction';
import { useCurrentUser } from '../../entities/user';

interface Props {
  transaction: Transaction;
  onClose: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #E2E8F0',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 14,
  color: '#0F172A',
  outline: 'none',
  background: '#F8FAFC',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: '#64748B',
  marginBottom: 6,
};

export function EditTransactionDialog({ transaction, onClose }: Props) {
  // ── User base currency ───────────────────────────────────────────────────────
  const { user } = useCurrentUser();
  const baseCurrency = user?.baseCurrency ?? null;

  // ── Cross-currency detection ────────────────────────────────────────────────
  const fromCurrency = transaction.sourceCurrency ?? transaction.accountCurrency ?? 'USD';
  const toCurrency = transaction.targetCurrency ?? transaction.accountCurrency ?? 'USD';
  const isCrossCurrency =
    transaction.type !== 'transfer' &&
    fromCurrency !== toCurrency &&
    !!transaction.sourceCurrency &&
    !!transaction.targetCurrency;

  // ── Case B detection ─────────────────────────────────────────────────────────
  // Case B: sourceCurrency ≠ baseCurrency AND accountCurrency ≠ baseCurrency
  // In this case the backend cannot infer the base-currency rate automatically,
  // so the user must supply it manually.
  const isCaseB =
    baseCurrency !== null &&
    transaction.type !== 'transfer' &&
    (transaction.sourceCurrency ?? transaction.accountCurrency) !== baseCurrency &&
    transaction.accountCurrency !== baseCurrency;

  // ── Date ────────────────────────────────────────────────────────────────────
  const [date, setDate] = useState<string>(
    transaction.transactionDate
      ? transaction.transactionDate.slice(0, 10)
      : transaction.createdAt.slice(0, 10),
  );

  // ── Three-field state (cross-currency) ──────────────────────────────────────
  // For expense: amount = category (target), accountAmount = account (source)
  // For income:  amount = source, accountAmount = account (target)
  const initSourceAmount = isCrossCurrency
    ? transaction.type === 'expense'
      ? String(transaction.accountAmount ?? transaction.amount)
      : String(transaction.amount)
    : '';
  const initTargetAmount = isCrossCurrency
    ? transaction.type === 'expense'
      ? String(transaction.amount)
      : String(transaction.accountAmount ?? transaction.amount)
    : '';
  const initExchangeRate = isCrossCurrency
    ? String(transaction.exchangeRate ?? 1)
    : '';

  const [sourceAmount, setSourceAmount] = useState(initSourceAmount);
  const [exchangeRate, setExchangeRate] = useState(initExchangeRate);
  const [targetAmount, setTargetAmount] = useState(initTargetAmount);
  const [rateIsCustom, setRateIsCustom] = useState(transaction.rateIsCustom ?? false);
  const [lastEdited, setLastEdited] = useState<'source' | 'rate' | 'target'>('source');

  // ── Base-currency rate state (Case B only) ───────────────────────────────────
  const [baseCurrencyRateInput, setBaseCurrencyRateInput] = useState<string>(
    transaction.baseCurrencyRate != null ? String(transaction.baseCurrencyRate) : '',
  );

  // ── Single-amount state (same-currency or transfer) ─────────────────────────
  const [amount, setAmount] = useState(
    isCrossCurrency ? '' : String(transaction.amount),
  );

  const [note, setNote] = useState(transaction.note ?? '');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [serverError, setServerError] = useState('');

  // ── Suggested exchange rate ──────────────────────────────────────────────────
  const { rate: suggestedRate } = useExchangeRate(
    isCrossCurrency ? fromCurrency : '',
    isCrossCurrency ? toCurrency : '',
    date,
  );

  const dateChangedRef = useRef(false);
  const [pendingSuggestedRate, setPendingSuggestedRate] = useState<number | null>(null);

  // Pre-fill exchange rate from API only when it arrives and rate is not custom
  useEffect(() => {
    if (!isCrossCurrency) return;
    if (suggestedRate !== null && !rateIsCustom) {
      setExchangeRate(suggestedRate.toFixed(4));
    }
  // Only run when suggestedRate changes; rateIsCustom intentionally omitted
  // so the user's custom flag is respected after first load
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedRate, isCrossCurrency]);

  // Show suggestion banner when date changes and new rate differs from current
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

  // ── Apollo mutation ──────────────────────────────────────────────────────────
  const [updateTransaction, { loading }] = useMutation(UPDATE_TRANSACTION_MUTATION, {
    refetchQueries: [
      ACCOUNTS_QUERY,
      EXPENSE_CATEGORIES_QUERY,
      INCOME_SOURCES_QUERY,
      { query: ACCOUNT_TRANSACTIONS_QUERY, variables: { accountId: transaction.accountId } },
      ...(transaction.expenseCategoryId
        ? [{ query: EXPENSE_CATEGORY_TRANSACTIONS_QUERY, variables: { categoryId: transaction.expenseCategoryId } }]
        : []),
      ...(transaction.incomeSourceId
        ? [{ query: INCOME_SOURCE_TRANSACTIONS_QUERY, variables: { sourceId: transaction.incomeSourceId } }]
        : []),
    ],
  });

  // ── Validation ───────────────────────────────────────────────────────────────
  const crossCurrencyFormIncomplete =
    isCrossCurrency &&
    (!sourceAmount ||
      parseFloat(sourceAmount) <= 0 ||
      !exchangeRate ||
      parseFloat(exchangeRate) <= 0 ||
      !targetAmount ||
      parseFloat(targetAmount) <= 0);

  const parsedSingleAmount = parseFloat(amount.trim());
  const singleAmountValid =
    !isCrossCurrency &&
    amount.trim() !== '' &&
    !isNaN(parsedSingleAmount) &&
    parsedSingleAmount > 0;

  const isValid = isCrossCurrency ? !crossCurrencyFormIncomplete : singleAmountValid;

  // ── Save handler ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setAmountError(null);
    setServerError('');

    if (isCrossCurrency) {
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

      // For expense: amount = category amount (tgt), accountAmount = account debit (src)
      // For income:  amount = source amount (src), accountAmount = account credit (tgt)
      const mutationAmount = transaction.type === 'expense' ? tgt : src;
      const mutationAccountAmount = transaction.type === 'expense' ? src : tgt;

      const parsedBaseCurrencyRate =
        isCaseB && baseCurrencyRateInput.trim() !== ''
          ? parseFloat(baseCurrencyRateInput.trim())
          : undefined;

      try {
        await updateTransaction({
          variables: {
            input: {
              id: transaction.id,
              amount: mutationAmount,
              accountAmount: mutationAccountAmount,
              exchangeRate: rate,
              rateIsCustom,
              note: note.trim() || null,
              transactionDate: date,
              ...(parsedBaseCurrencyRate !== undefined && !isNaN(parsedBaseCurrencyRate)
                ? { baseCurrencyRate: parsedBaseCurrencyRate }
                : {}),
            },
          },
        });
        onClose();
      } catch (e: unknown) {
        setServerError(e instanceof Error ? e.message : 'Failed to update transaction');
      }
      return;
    }

    // Single-currency / transfer path
    const val = parseFloat(amount.trim());
    if (isNaN(val) || val <= 0) {
      setAmountError('Amount must be greater than 0');
      return;
    }

    const parsedBaseCurrencyRateSingle =
      isCaseB && baseCurrencyRateInput.trim() !== ''
        ? parseFloat(baseCurrencyRateInput.trim())
        : undefined;

    try {
      await updateTransaction({
        variables: {
          input: {
            id: transaction.id,
            amount: val,
            note: note.trim() || null,
            transactionDate: date,
            ...(parsedBaseCurrencyRateSingle !== undefined &&
            !isNaN(parsedBaseCurrencyRateSingle)
              ? { baseCurrencyRate: parsedBaseCurrencyRateSingle }
              : {}),
          },
        },
      });
      onClose();
    } catch (e: unknown) {
      setServerError(e instanceof Error ? e.message : 'Failed to update transaction');
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15,23,42,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 20,
          padding: 28,
          maxWidth: 400,
          width: '100%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700, color: '#0F172A' }}>
          Edit Transaction
        </h3>

        {transaction.type === 'transfer' && (
          <p style={{ margin: '0 0 16px', fontSize: 13, color: '#94A3B8', lineHeight: 1.5 }}>
            Editing the transfer amount will update both accounts.
          </p>
        )}

        {isCrossCurrency ? (
          <>
            {/* Source amount */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Amount ({fromCurrency})</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={sourceAmount}
                onChange={(e) => {
                  setLastEdited('source');
                  setSourceAmount(e.target.value);
                }}
                style={{
                  ...inputStyle,
                  border: `1px solid ${amountError ? '#EF4444' : '#E2E8F0'}`,
                }}
              />
            </div>

            {/* Exchange rate */}
            <div style={{ marginBottom: 16 }}>
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
                min="0.0001"
                step="0.0001"
                value={exchangeRate}
                onChange={(e) => {
                  setLastEdited('rate');
                  setRateIsCustom(true);
                  setExchangeRate(e.target.value);
                }}
                style={inputStyle}
              />
              <p style={{ fontSize: 12, color: '#94A3B8', margin: '4px 0 0' }}>
                1 {fromCurrency} = {exchangeRate || '?'} {toCurrency}
              </p>
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
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Total ({toCurrency})</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={targetAmount}
                onChange={(e) => {
                  setLastEdited('target');
                  setTargetAmount(e.target.value);
                }}
                style={{
                  ...inputStyle,
                  border: `1px solid ${amountError ? '#EF4444' : '#E2E8F0'}`,
                }}
              />
            </div>

            {amountError && (
              <p style={{ color: '#EF4444', fontSize: 13, margin: '0 0 12px' }}>{amountError}</p>
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
                  marginBottom: 16,
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
          /* Single-currency / transfer amount field */
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Amount</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 14, color: '#64748B' }}>$</span>
              <input
                type="number"
                min="0.01"
                step="any"
                value={amount}
                onChange={(e) => {
                  const val = e.target.value;
                  setAmount(val);
                  if (val.trim() === '') {
                    setAmountError(null);
                  } else {
                    const parsed = parseFloat(val);
                    setAmountError(
                      isNaN(parsed) || parsed <= 0 ? 'Amount must be greater than 0' : null,
                    );
                  }
                }}
                autoFocus
                style={{
                  flex: 1,
                  border: amountError ? '1px solid #EF4444' : '1px solid #E2E8F0',
                  borderRadius: 8,
                  padding: '10px 12px',
                  fontSize: 16,
                  color: '#0F172A',
                  outline: 'none',
                  background: '#F8FAFC',
                }}
              />
            </div>
            {amountError && (
              <div style={{ fontSize: 12, color: '#EF4444', marginTop: 4 }}>{amountError}</div>
            )}
          </div>
        )}

        {/* Case B: base-currency conversion rate (shown only when neither source nor account currency equals base currency) */}
        {isCaseB && baseCurrency && (
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>
              Conversion rate to {baseCurrency}
            </label>
            <input
              type="number"
              min="0.000001"
              step="0.000001"
              value={baseCurrencyRateInput}
              onChange={(e) => setBaseCurrencyRateInput(e.target.value)}
              placeholder="e.g. 0.0248"
              style={inputStyle}
            />
            <p style={{ fontSize: 12, color: '#94A3B8', margin: '4px 0 0' }}>
              1{' '}
              {transaction.sourceCurrency ?? transaction.accountCurrency}{' '}
              ={' '}
              {baseCurrencyRateInput || '?'}{' '}
              {baseCurrency}
            </p>
          </div>
        )}

        {/* Date */}
        <div style={{ marginBottom: 16 }}>
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
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note..."
            style={inputStyle}
          />
        </div>

        {serverError && (
          <p style={{ color: '#EF4444', fontSize: 13, margin: '0 0 12px' }}>{serverError}</p>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              background: 'none',
              border: '1px solid #E2E8F0',
              borderRadius: 10,
              cursor: 'pointer',
              fontSize: 14,
              color: '#475569',
              padding: '8px 16px',
              fontWeight: 600,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid || loading}
            style={{
              background: !isValid || loading ? '#C4B5FD' : '#4F46E5',
              border: 'none',
              borderRadius: 10,
              cursor: !isValid || loading ? 'not-allowed' : 'pointer',
              fontSize: 14,
              color: '#FFFFFF',
              padding: '8px 16px',
              fontWeight: 600,
            }}
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
