import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@apollo/client';
import type { Account } from '../../entities/account';
import { CREATE_TRANSFER_TRANSACTION_MUTATION } from '../../entities/transaction/api/transactions.mutations';
import { ACCOUNT_TRANSACTIONS_QUERY } from '../../entities/transaction/api/transactions.queries';
import { ACCOUNTS_QUERY } from '../../entities/account/api/accounts.query';
import { useExchangeRate } from '../../entities/rate';

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
  const isCrossCurrency = fromAccount.currency !== toAccount.currency;
  const today = new Date().toISOString().slice(0, 10);

  // ── Three-field state (cross-currency) ──────────────────────────────────────
  const [sourceAmount, setSourceAmount] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [rateIsCustom, setRateIsCustom] = useState(false);
  const [lastEdited, setLastEdited] = useState<'source' | 'rate' | 'target'>('source');

  // ── Single-amount state (same-currency) ─────────────────────────────────────
  const [amount, setAmount] = useState('');

  const [note, setNote] = useState('');
  const [date, setDate] = useState<string>(today);
  const [amountError, setAmountError] = useState('');

  // ── Exchange rate from GraphQL ───────────────────────────────────────────────
  const { rate: suggestedRate, stale: rateIsStale } = useExchangeRate(
    isCrossCurrency ? fromAccount.currency : '',
    isCrossCurrency ? toAccount.currency : '',
    date,
  );

  // Track whether the user has changed the date after modal open
  const dateChangedRef = useRef(false);

  // Pending suggested rate for the inline banner
  const [pendingSuggestedRate, setPendingSuggestedRate] = useState<number | null>(null);

  // Pre-fill exchange rate when API returns it (only if user hasn't set a custom rate)
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

  // ── Validation ───────────────────────────────────────────────────────────────
  const crossCurrencyFormIncomplete =
    isCrossCurrency &&
    (!sourceAmount ||
      parseFloat(sourceAmount) <= 0 ||
      !exchangeRate ||
      parseFloat(exchangeRate) <= 0 ||
      !targetAmount ||
      parseFloat(targetAmount) <= 0);

  const singleAmountValid = !isCrossCurrency && !!amount && parseFloat(amount) > 0;
  const isValid = isCrossCurrency ? !crossCurrencyFormIncomplete : singleAmountValid;

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
    if (!isCrossCurrency && (!amount || parseFloat(amount) <= 0)) {
      setAmountError('Amount is required');
    } else {
      setAmountError('');
    }
  };

  const handleSourceAmountBlur = () => {
    if (isCrossCurrency && (!sourceAmount || parseFloat(sourceAmount) <= 0)) {
      setAmountError('Amount is required');
    } else {
      setAmountError('');
    }
  };

  const handleConfirm = async () => {
    setAmountError('');

    if (isCrossCurrency) {
      const src = parseFloat(sourceAmount);
      const rate = parseFloat(exchangeRate);
      const tgt = parseFloat(targetAmount);

      if (isNaN(src) || src <= 0) {
        setAmountError(`Amount (${fromAccount.currency}) must be greater than 0`);
        return;
      }
      if (isNaN(rate) || rate <= 0) {
        setAmountError('Exchange rate must be greater than 0');
        return;
      }
      if (isNaN(tgt) || tgt <= 0) {
        setAmountError(`Amount (${toAccount.currency}) must be greater than 0`);
        return;
      }

      await createTransfer({
        variables: {
          input: {
            fromAccountId: fromAccount.id,
            toAccountId: toAccount.id,
            fromAmount: src,
            toAmount: tgt,
            fromCurrency: fromAccount.currency,
            toCurrency: toAccount.currency,
            exchangeRate: rate,
            note: note || null,
          },
        },
        onCompleted: () => onClose(),
      });
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setAmountError('Amount is required');
      return;
    }

    await createTransfer({
      variables: {
        input: {
          fromAccountId: fromAccount.id,
          toAccountId: toAccount.id,
          fromAmount: parsedAmount,
          toAmount: parsedAmount,
          fromCurrency: fromAccount.currency,
          toCurrency: toAccount.currency,
          exchangeRate: 1.0,
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

        {/* ── Cross-currency: three-field layout ── */}
        {isCrossCurrency ? (
          <>
            {/* Source amount */}
            <div>
              <label style={labelStyle}>Amount ({fromAccount.currency})</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={sourceAmount}
                onChange={(e) => {
                  setLastEdited('source');
                  setSourceAmount(e.target.value);
                  setAmountError('');
                }}
                onBlur={handleSourceAmountBlur}
                placeholder="0.00"
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
                min="0"
                step="0.0001"
                value={exchangeRate}
                onChange={(e) => {
                  setLastEdited('rate');
                  setRateIsCustom(true);
                  setExchangeRate(e.target.value);
                }}
                placeholder="0.0000"
                style={inputStyle}
              />
              <p style={{ fontSize: 12, color: '#94A3B8', margin: '4px 0 0' }}>
                1 {fromAccount.currency} = {exchangeRate || '?'} {toAccount.currency}
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
              <label style={labelStyle}>Amount ({toAccount.currency})</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={targetAmount}
                onChange={(e) => {
                  setLastEdited('target');
                  setTargetAmount(e.target.value);
                }}
                placeholder="0.00"
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
          /* ── Same-currency: single amount field ── */
          <div>
            <label style={labelStyle}>Amount ({fromAccount.currency})</label>
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
            max={today}
            style={inputStyle}
          />
        </div>

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
