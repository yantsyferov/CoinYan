import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { useIncomeSources, INCOME_SOURCES_QUERY } from '../../entities/category';
import { INCOME_TOTALS_BY_CURRENCY_QUERY } from '../../entities/category/api/income-sources.query';
import { INCOME_SOURCE_TRANSACTIONS_QUERY, CANCEL_TRANSACTION_MUTATION } from '../../entities/transaction';
import { ACCOUNTS_QUERY } from '../../entities/account';
import { ACCOUNT_ICONS } from '../../shared/lib/account-icons';
import { formatCurrency } from '../../shared/lib/format-currency';
import { formatDate } from '../../shared/lib/format-date';
import { EditTransactionDialog } from '../../features/transaction/EditTransactionDialog';
import type { Transaction } from '../../entities/transaction';
import { groupByMonth } from '../../shared/lib/group-by-month';

interface IncomeSourceTransactionsData {
  incomeSourceTransactions: Transaction[];
}

interface CurrencyTotal {
  currency: string;
  amount: number;
}

interface IncomeTotalsByCurrencyData {
  incomeTotalsByCurrency: CurrencyTotal[];
}

function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function IncomeSourceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [confirmCancel, setConfirmCancel] = useState<{ id: string; amount: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ txn: Transaction; x: number; y: number } | null>(null);
  const [editTarget, setEditTarget] = useState<Transaction | null>(null);

  const { sources, loading: loadingSources } = useIncomeSources();
  const source = sources.find((s) => s.id === id);

  const LIMIT = 50;
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data, loading: loadingTxns, fetchMore } = useQuery<IncomeSourceTransactionsData>(
    INCOME_SOURCE_TRANSACTIONS_QUERY,
    {
      variables: { sourceId: id, limit: LIMIT, offset: 0 },
      skip: !id,
      fetchPolicy: 'cache-and-network',
    },
  );

  const currentMonth = getCurrentMonth();
  const { data: currencyTotalsData } = useQuery<IncomeTotalsByCurrencyData>(
    INCOME_TOTALS_BY_CURRENCY_QUERY,
    {
      variables: { incomeSourceId: id, month: currentMonth },
      skip: !id,
      fetchPolicy: 'cache-and-network',
    },
  );
  const currencyTotals = currencyTotalsData?.incomeTotalsByCurrency ?? [];

  useEffect(() => {
    const fresh = data?.incomeSourceTransactions ?? [];
    setAllTransactions(fresh);
    setHasMore(fresh.length >= LIMIT);
  }, [data]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isFetchingMore) {
          setIsFetchingMore(true);
          fetchMore({
            variables: { offset: allTransactions.length },
          }).then((result) => {
            const next = result.data?.incomeSourceTransactions ?? [];
            setAllTransactions((prev) => [...prev, ...next]);
            setHasMore(next.length >= LIMIT);
            setIsFetchingMore(false);
          }).catch(() => setIsFetchingMore(false));
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isFetchingMore, allTransactions.length, fetchMore]);

  const [cancelTransaction, { loading: cancelling }] = useMutation(
    CANCEL_TRANSACTION_MUTATION,
    {
      refetchQueries: [
        ACCOUNTS_QUERY,
        INCOME_SOURCES_QUERY,
        { query: INCOME_SOURCE_TRANSACTIONS_QUERY, variables: { sourceId: id } },
      ],
    },
  );

  const handleConfirmCancel = async () => {
    if (!confirmCancel) return;
    await cancelTransaction({ variables: { id: confirmCancel.id } });
    setConfirmCancel(null);
  };

  const totalReceived = allTransactions.reduce((sum, t) => sum + t.amount, 0);
  const groupedTransactions = useMemo(() => groupByMonth(allTransactions), [allTransactions]);

  if (loadingSources || loadingTxns) {
    return (
      <div style={{ backgroundColor: '#F1F5F9', minHeight: '100vh' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 16px' }}>
          <div style={{ height: 56, display: 'flex', alignItems: 'center' }}>
            <button onClick={() => navigate('/')} style={backBtnStyle}>← Back</button>
          </div>
          <div style={{ color: '#94A3B8', fontSize: 14, padding: '32px 0', textAlign: 'center' }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!source) {
    return (
      <div style={{ backgroundColor: '#F1F5F9', minHeight: '100vh' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 16px' }}>
          <div style={{ height: 56, display: 'flex', alignItems: 'center' }}>
            <button onClick={() => navigate('/')} style={backBtnStyle}>← Back</button>
          </div>
          <p style={{ color: '#94A3B8', fontSize: 14 }}>Income source not found.</p>
        </div>
      </div>
    );
  }

  const icon = ACCOUNT_ICONS[source.icon] ?? source.icon ?? '💹';

  return (
    <div style={{ backgroundColor: '#F1F5F9', minHeight: '100vh', paddingBottom: 32 }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 16px' }}>
        {/* Top bar */}
        <div style={{ height: 56, display: 'flex', alignItems: 'center' }}>
          <button onClick={() => navigate('/')} style={backBtnStyle}>← Back</button>
        </div>

        {/* Header card */}
        <div
          style={{
            backgroundColor: '#fff',
            borderRadius: 16,
            padding: 24,
            marginBottom: 16,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 9999,
              background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>
              {source.name}
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#4F46E5', margin: '2px 0 0' }}>
              {formatCurrency(totalReceived)}
            </div>
            {/* Per-currency breakdown */}
            {currencyTotals.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                  By currency
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {currencyTotals.map((entry) => (
                    <div key={entry.currency} style={{ fontSize: 13, color: '#475569' }}>
                      {formatCurrency(entry.amount, entry.currency)} {entry.currency}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Transactions */}
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: '0 0 12px' }}>
          Transactions
        </h2>

        {allTransactions.length === 0 ? (
          <p style={{ color: '#94A3B8', fontSize: 14, textAlign: 'center', padding: '32px 0' }}>
            No transactions yet.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {groupedTransactions.map((group) => (
              <div key={group.label}>
                <div style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#94A3B8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '16px 0 8px',
                }}>
                  {group.label}
                </div>
                {group.transactions.map((txn) => (
                  <div
                    key={txn.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setContextMenu({ txn, x: e.clientX, y: e.clientY });
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') setContextMenu({ txn, x: 0, y: 0 });
                    }}
                    style={{
                      backgroundColor: '#fff',
                      borderRadius: 12,
                      padding: '14px 16px',
                      marginBottom: 8,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 2 }}>{formatDate(txn.transactionDate ?? txn.createdAt)}</div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#0F172A' }}>
                        {txn.note ?? 'Income'}
                      </div>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#10B981' }}>
                      +{formatCurrency(txn.amount)}
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {isFetchingMore && (
              <div style={{ textAlign: 'center', padding: '16px 0', color: '#94A3B8', fontSize: 13 }}>
                Loading...
              </div>
            )}
            <div ref={sentinelRef} style={{ height: 1 }} />
          </div>
        )}
        {/* Context menu */}
        {contextMenu && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 100 }}
              onClick={() => setContextMenu(null)}
            />
            <div style={{
              position: 'fixed',
              top: contextMenu.y,
              left: contextMenu.x,
              zIndex: 101,
              background: 'white',
              borderRadius: 12,
              boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
              overflow: 'hidden',
              minWidth: 140,
            }}>
              <button
                style={{ display: 'block', width: '100%', padding: '12px 20px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15 }}
                onClick={() => {
                  setEditTarget(contextMenu.txn);
                  setContextMenu(null);
                }}
              >
                Edit
              </button>
              <button
                style={{ display: 'block', width: '100%', padding: '12px 20px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#ef4444' }}
                onClick={() => {
                  setConfirmCancel({ id: contextMenu.txn.id, amount: contextMenu.txn.amount });
                  setContextMenu(null);
                }}
              >
                Delete
              </button>
            </div>
          </>
        )}

        {editTarget && (
          <EditTransactionDialog
            transaction={editTarget}
            onClose={() => setEditTarget(null)}
          />
        )}

        {/* Cancel transaction confirmation dialog */}
        {confirmCancel !== null && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15,23,42,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 50,
              padding: 16,
            }}
            onClick={() => setConfirmCancel(null)}
          >
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 20,
                padding: 28,
                maxWidth: 360,
                width: '100%',
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#0F172A' }}>
                Cancel transaction?
              </h3>
              <p style={{ margin: '0 0 4px', fontSize: 14, color: '#475569', lineHeight: 1.5 }}>
                Income · {formatCurrency(confirmCancel.amount)}
              </p>
              <p style={{ margin: '0 0 20px', fontSize: 13, color: '#94A3B8', lineHeight: 1.5 }}>
                This will permanently remove the entry and restore the income source total.
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setConfirmCancel(null)}
                  disabled={cancelling}
                  style={keepBtnStyle}
                >
                  Keep
                </button>
                <button
                  onClick={handleConfirmCancel}
                  disabled={cancelling}
                  style={cancelBtnStyle}
                >
                  {cancelling ? 'Cancelling...' : 'Cancel transaction'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const backBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: 14,
  color: '#7C3AED',
  padding: 0,
  fontWeight: 600,
};

const keepBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #E2E8F0',
  borderRadius: 10,
  cursor: 'pointer',
  fontSize: 14,
  color: '#475569',
  padding: '8px 16px',
  fontWeight: 600,
};

const cancelBtnStyle: React.CSSProperties = {
  background: '#EF4444',
  border: 'none',
  borderRadius: 10,
  cursor: 'pointer',
  fontSize: 14,
  color: '#FFFFFF',
  padding: '8px 16px',
  fontWeight: 600,
};
