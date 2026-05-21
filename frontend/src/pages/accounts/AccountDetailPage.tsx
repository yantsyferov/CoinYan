import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { useAccounts, ACCOUNTS_QUERY } from '../../entities/account';
import { ACCOUNT_TRANSACTIONS_QUERY, CANCEL_TRANSACTION_MUTATION } from '../../entities/transaction';
import { INCOME_SOURCES_QUERY, EXPENSE_CATEGORIES_QUERY } from '../../entities/category';
import { ACCOUNT_ICONS } from '../../shared/lib/account-icons';
import { formatCurrency } from '../../shared/lib/format-currency';
import { EditAccountModal } from '../../features/account/edit-account';
import type { Transaction } from '../../entities/transaction';

interface AccountTransactionsData {
  accountTransactions: Transaction[];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showEdit, setShowEdit] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState<{ id: string; type: string; amount: number } | null>(null);

  const { accounts, loading: loadingAccounts } = useAccounts();
  const account = accounts.find((a) => a.id === id);

  const { data, loading: loadingTxns } = useQuery<AccountTransactionsData>(
    ACCOUNT_TRANSACTIONS_QUERY,
    {
      variables: { accountId: id },
      skip: !id,
      fetchPolicy: 'cache-and-network',
    },
  );

  const [cancelTransaction, { loading: cancelling }] = useMutation(
    CANCEL_TRANSACTION_MUTATION,
    {
      refetchQueries: [
        ACCOUNTS_QUERY,
        INCOME_SOURCES_QUERY,
        EXPENSE_CATEGORIES_QUERY,
        { query: ACCOUNT_TRANSACTIONS_QUERY, variables: { accountId: id } },
      ],
    },
  );

  const transactions = data?.accountTransactions ?? [];

  const handleConfirmCancel = async () => {
    if (!confirmCancel) return;
    await cancelTransaction({ variables: { id: confirmCancel.id } });
    setConfirmCancel(null);
  };

  if (loadingAccounts || loadingTxns) {
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

  if (!account) {
    return (
      <div style={{ backgroundColor: '#F1F5F9', minHeight: '100vh' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 16px' }}>
          <div style={{ height: 56, display: 'flex', alignItems: 'center' }}>
            <button onClick={() => navigate('/')} style={backBtnStyle}>← Back</button>
          </div>
          <p style={{ color: '#94A3B8', fontSize: 14 }}>Account not found.</p>
        </div>
      </div>
    );
  }

  const icon = ACCOUNT_ICONS[account.icon] ?? '💰';

  return (
    <div style={{ backgroundColor: '#F1F5F9', minHeight: '100vh', paddingBottom: 32 }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 16px' }}>
        {/* Top bar */}
        <div style={{ height: 56, display: 'flex', alignItems: 'center' }}>
          <button onClick={() => navigate('/')} style={backBtnStyle}>← Back</button>
        </div>

        {/* Account header card */}
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
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>
              {account.name}
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#4F46E5', margin: '2px 0 0' }}>
              {formatCurrency(account.currentBalance, account.currency)}
            </div>
          </div>
          <button onClick={() => setShowEdit(true)} style={editBtnStyle}>
            Edit
          </button>
        </div>

        {showEdit && (
          <EditAccountModal
            account={account}
            onClose={() => setShowEdit(false)}
            onDeleted={() => navigate('/')}
          />
        )}

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
            {transactions.map((txn) => {
              if (txn.type === 'transfer') {
                const isIncoming = txn.toAccountId === account.id;
                const counterpartId = isIncoming ? txn.fromAccountId : txn.toAccountId;
                const counterpart = counterpartId ? accounts.find((a) => a.id === counterpartId) : undefined;
                const counterpartLabel = counterpart ? counterpart.name : 'Transfer';
                return (
                  <div
                    key={txn.id}
                    onClick={() => setConfirmCancel({ id: txn.id, type: txn.type, amount: txn.amount })}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') setConfirmCancel({ id: txn.id, type: txn.type, amount: txn.amount });
                    }}
                    style={{
                      backgroundColor: '#FAFAFF',
                      borderRadius: 12,
                      padding: '14px 16px',
                      marginBottom: 8,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      borderLeft: '3px solid #7C3AED',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 2 }}>{formatDate(txn.createdAt)}</div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#0F172A' }}>
                        <span style={{ marginRight: 6 }}>⇄</span>
                        {txn.note ? `${txn.note} · ${counterpartLabel}` : counterpartLabel}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: isIncoming ? '#10B981' : '#EF4444',
                      }}
                    >
                      {isIncoming ? '+' : '−'}
                      {formatCurrency(txn.amount)}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={txn.id}
                  onClick={() => setConfirmCancel({ id: txn.id, type: txn.type, amount: txn.amount })}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setConfirmCancel({ id: txn.id, type: txn.type, amount: txn.amount });
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
                      {txn.note ?? txn.type}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: txn.type === 'expense' ? '#EF4444' : '#10B981',
                    }}
                  >
                    {txn.type === 'expense' ? '−' : '+'}
                    {formatCurrency(txn.amount)}
                  </div>
                </div>
              );
            })}
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
                {confirmCancel.type.charAt(0).toUpperCase() + confirmCancel.type.slice(1)} · {formatCurrency(confirmCancel.amount)}
              </p>
              <p style={{ margin: '0 0 20px', fontSize: 13, color: '#94A3B8', lineHeight: 1.5 }}>
                This will permanently remove the entry and restore the affected balance.
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
                  style={cancelTransferBtnStyle}
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

const editBtnStyle: React.CSSProperties = {
  border: '1px solid #E2E8F0',
  borderRadius: 8,
  padding: '6px 14px',
  fontSize: 13,
  fontWeight: 600,
  color: '#475569',
  background: '#fff',
  cursor: 'pointer',
  flexShrink: 0,
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

const cancelTransferBtnStyle: React.CSSProperties = {
  background: '#EF4444',
  border: 'none',
  borderRadius: 10,
  cursor: 'pointer',
  fontSize: 14,
  color: '#FFFFFF',
  padding: '8px 16px',
  fontWeight: 600,
};
