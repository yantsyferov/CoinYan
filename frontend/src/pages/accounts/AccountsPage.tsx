import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccounts } from '../../entities/account';
import type { Account } from '../../entities/account';
import { ACCOUNT_ICONS } from '../../shared/lib/account-icons';
import { CreateAccountModal } from '../../features/account/create-account';
import { EditAccountModal } from '../../features/account/edit-account';
import { DeleteAccountMenu } from '../../features/account/delete-account';

export function AccountsPage() {
  const { accounts, loading, error } = useAccounts();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error loading accounts.</p>;

  return (
    <main style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1 style={{ margin: 0 }}>My Accounts</h1>
        <Link
          to="/accounts/archived"
          style={{
            fontSize: '13px',
            color: '#4F46E5',
            textDecoration: 'none',
          }}
        >
          Archived &rarr;
        </Link>
      </div>
      <div
        style={{
          display: 'flex',
          gap: '16px',
          overflowX: 'auto',
          paddingBottom: '8px',
        }}
      >
        {accounts.map((account) => (
          <div
            key={account.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              minWidth: '72px',
              position: 'relative',
            }}
          >
            <div style={{ position: 'relative' }}>
              <div
                onClick={() => setEditingAccount(account)}
                style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '50%',
                  backgroundColor: '#4F46E5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '28px',
                  cursor: 'pointer',
                }}
              >
                {ACCOUNT_ICONS[account.icon] ?? '💰'}
              </div>
              {/* Context menu button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeletingAccount(account);
                }}
                title="More options"
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  border: '1px solid #D1D5DB',
                  backgroundColor: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '10px',
                  lineHeight: 1,
                  padding: 0,
                  color: '#374151',
                }}
              >
                &#8943;
              </button>
            </div>
            <span
              style={{
                fontSize: '12px',
                textAlign: 'center',
                maxWidth: '72px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {account.name}
            </span>
            <span style={{ fontSize: '11px', color: '#6B7280' }}>
              {account.currentBalance.toFixed(2)} {account.currency}
            </span>
          </div>
        ))}

        {/* Add account button */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            minWidth: '72px',
          }}
        >
          <div
            onClick={() => setShowCreateModal(true)}
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              backgroundColor: '#E5E7EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              cursor: 'pointer',
              color: '#374151',
            }}
          >
            +
          </div>
          <span style={{ fontSize: '12px', color: '#6B7280' }}>Add</span>
        </div>
      </div>
      {showCreateModal && <CreateAccountModal onClose={() => setShowCreateModal(false)} />}
      {editingAccount && (
        <EditAccountModal account={editingAccount} onClose={() => setEditingAccount(null)} />
      )}
      {deletingAccount && (
        <DeleteAccountMenu account={deletingAccount} onClose={() => setDeletingAccount(null)} />
      )}
    </main>
  );
}
