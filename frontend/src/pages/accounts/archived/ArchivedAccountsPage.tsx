import { gql, useQuery, useMutation } from '@apollo/client';
import { Link } from 'react-router-dom';
import { ACCOUNT_ICONS } from '../../../shared/lib/account-icons';
import { ACCOUNTS_QUERY } from '../../../entities/account';
import type { Account } from '../../../entities/account';

const ARCHIVED_ACCOUNTS_QUERY = gql`
  query ArchivedAccounts {
    archivedAccounts {
      id
      name
      icon
      currency
      currentBalance
      status
      deletedAt
      createdAt
    }
  }
`;

const RESTORE_ACCOUNT_MUTATION = gql`
  mutation RestoreAccount($id: ID!) {
    restoreAccount(id: $id) {
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

function daysRemaining(deletedAt: string | null): number | null {
  if (!deletedAt) return null;
  const deleted = new Date(deletedAt).getTime();
  const deadline = deleted + 30 * 24 * 60 * 60 * 1000;
  const remaining = Math.ceil((deadline - Date.now()) / (24 * 60 * 60 * 1000));
  return Math.max(0, remaining);
}

interface RestoreButtonProps {
  accountId: string;
}

function RestoreButton({ accountId }: RestoreButtonProps) {
  const [restoreAccount, { loading }] = useMutation(RESTORE_ACCOUNT_MUTATION, {
    refetchQueries: [{ query: ARCHIVED_ACCOUNTS_QUERY }, { query: ACCOUNTS_QUERY }],
  });

  const handleRestore = async () => {
    try {
      await restoreAccount({ variables: { id: accountId } });
    } catch {
      // error is surfaced via Apollo error state; keep UX simple here
    }
  };

  return (
    <button
      onClick={handleRestore}
      disabled={loading}
      style={{
        padding: '6px 14px',
        borderRadius: '6px',
        border: 'none',
        background: '#4F46E5',
        color: '#fff',
        cursor: loading ? 'not-allowed' : 'pointer',
        fontSize: '13px',
        opacity: loading ? 0.7 : 1,
        flexShrink: 0,
      }}
    >
      {loading ? 'Restoring...' : 'Restore'}
    </button>
  );
}

export function ArchivedAccountsPage() {
  const { data, loading, error } = useQuery<{ archivedAccounts: Account[] }>(
    ARCHIVED_ACCOUNTS_QUERY,
  );

  if (loading) return <p style={{ padding: '24px' }}>Loading...</p>;
  if (error) return <p style={{ padding: '24px' }}>Error loading archived accounts.</p>;

  const archived = data?.archivedAccounts ?? [];

  return (
    <main style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <Link
          to="/accounts"
          style={{
            fontSize: '13px',
            color: '#4F46E5',
            textDecoration: 'none',
          }}
        >
          &larr; Back to Accounts
        </Link>
      </div>

      <h1 style={{ marginBottom: '24px', marginTop: 0 }}>Archived Accounts</h1>

      {archived.length === 0 ? (
        <p style={{ color: '#6B7280', fontSize: '14px' }}>No archived accounts</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {archived.map((account) => {
            const days = daysRemaining(account.deletedAt);
            return (
              <div
                key={account.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '16px',
                  borderRadius: '10px',
                  border: '1px solid #E5E7EB',
                  backgroundColor: '#FAFAFA',
                }}
              >
                {/* Icon */}
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: '#E5E7EB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '22px',
                    flexShrink: 0,
                  }}
                >
                  {ACCOUNT_ICONS[account.icon] ?? '💰'}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontWeight: 600,
                      fontSize: '14px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {account.name}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6B7280' }}>
                    {account.status}
                  </p>
                  {days !== null && (
                    <p
                      style={{
                        margin: '2px 0 0',
                        fontSize: '11px',
                        color: days <= 3 ? '#EF4444' : '#9CA3AF',
                      }}
                    >
                      {days > 0
                        ? `${days} day${days === 1 ? '' : 's'} left to recover`
                        : 'Recovery window expired'}
                    </p>
                  )}
                </div>

                {/* Balance */}
                <div
                  style={{
                    fontSize: '13px',
                    color: '#374151',
                    flexShrink: 0,
                    textAlign: 'right',
                  }}
                >
                  {account.currentBalance.toFixed(2)} {account.currency}
                </div>

                <RestoreButton accountId={account.id} />
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
