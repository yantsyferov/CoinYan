import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { useExpenseCategories, EXPENSE_CATEGORIES_QUERY } from '../../entities/category';
import { EXPENSE_CATEGORY_TRANSACTIONS_QUERY, CANCEL_TRANSACTION_MUTATION } from '../../entities/transaction';
import { ACCOUNTS_QUERY } from '../../entities/account';
import { ACCOUNT_ICONS } from '../../shared/lib/account-icons';
import { formatCurrency } from '../../shared/lib/format-currency';
import type { Transaction } from '../../entities/transaction';

interface ExpenseCategoryTransactionsData {
  expenseCategoryTransactions: Transaction[];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ExpenseCategoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [confirmCancel, setConfirmCancel] = useState<{ id: string; amount: number } | null>(null);

  const { categories, loading: loadingCategories } = useExpenseCategories();
  const category = categories.find((c) => c.id === id);

  const { data, loading: loadingTxns } = useQuery<ExpenseCategoryTransactionsData>(
    EXPENSE_CATEGORY_TRANSACTIONS_QUERY,
    {
      variables: { categoryId: id },
      skip: !id,
      fetchPolicy: 'cache-and-network',
    },
  );

  const [cancelTransaction, { loading: cancelling }] = useMutation(
    CANCEL_TRANSACTION_MUTATION,
    {
      refetchQueries: [
        ACCOUNTS_QUERY,
        EXPENSE_CATEGORIES_QUERY,
        { query: EXPENSE_CATEGORY_TRANSACTIONS_QUERY, variables: { categoryId: id } },
      ],
    },
  );

  const handleConfirmCancel = async () => {
    if (!confirmCancel) return;
    await cancelTransaction({ variables: { id: confirmCancel.id } });
    setConfirmCancel(null);
  };

  const transactions = data?.expenseCategoryTransactions ?? [];
  const totalSpent = transactions.reduce((sum, t) => sum + t.amount, 0);

  if (loadingCategories || loadingTxns) {
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

  if (!category) {
    return (
      <div style={{ backgroundColor: '#F1F5F9', minHeight: '100vh' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 16px' }}>
          <div style={{ height: 56, display: 'flex', alignItems: 'center' }}>
            <button onClick={() => navigate('/')} style={backBtnStyle}>← Back</button>
          </div>
          <p style={{ color: '#94A3B8', fontSize: 14 }}>Category not found.</p>
        </div>
      </div>
    );
  }

  const icon = ACCOUNT_ICONS[category.icon] ?? category.icon ?? '🧾';

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
              {category.name}
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#4F46E5', margin: '2px 0 0' }}>
              {formatCurrency(totalSpent)}
            </div>
          </div>
        </div>

        {/* Transactions */}
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: '0 0 12px' }}>
          Transactions
        </h2>

        {transactions.length === 0 ? (
          <p style={{ color: '#94A3B8', fontSize: 14, textAlign: 'center', padding: '32px 0' }}>
            No transactions yet.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {transactions.map((txn) => (
              <div
                key={txn.id}
                onClick={() => setConfirmCancel({ id: txn.id, amount: txn.amount })}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setConfirmCancel({ id: txn.id, amount: txn.amount });
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
                  <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 2 }}>{formatDate(txn.createdAt)}</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#0F172A' }}>
                    {txn.note ?? 'Expense'}
                  </div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#EF4444' }}>
                  −{formatCurrency(txn.amount)}
                </div>
              </div>
            ))}
          </div>
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
                Expense · {formatCurrency(confirmCancel.amount)}
              </p>
              <p style={{ margin: '0 0 20px', fontSize: 13, color: '#94A3B8', lineHeight: 1.5 }}>
                This will permanently remove the entry and restore the category total.
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
