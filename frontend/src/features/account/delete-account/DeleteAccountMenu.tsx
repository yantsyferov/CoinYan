import { useState } from 'react';
import { gql, useMutation } from '@apollo/client';
import { ACCOUNTS_QUERY } from '../../../entities/account';
import type { Account } from '../../../entities/account';

const ARCHIVE_ACCOUNT_MUTATION = gql`
  mutation ArchiveAccount($id: ID!) {
    archiveAccount(id: $id)
  }
`;

const DELETE_ACCOUNT_MUTATION = gql`
  mutation DeleteAccount($id: ID!, $option: DeleteAccountOption!) {
    deleteAccount(id: $id, option: $option)
  }
`;

interface Props {
  account: Account;
  onClose: () => void;
}

export function DeleteAccountMenu({ account, onClose }: Props) {
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [serverError, setServerError] = useState('');

  const refetchOptions = { refetchQueries: [{ query: ACCOUNTS_QUERY }] };

  const [archiveAccount, { loading: archiving }] = useMutation(
    ARCHIVE_ACCOUNT_MUTATION,
    refetchOptions,
  );
  const [deleteAccount, { loading: deleting }] = useMutation(
    DELETE_ACCOUNT_MUTATION,
    refetchOptions,
  );

  const isLoading = archiving || deleting;

  const handleArchive = async () => {
    setServerError('');
    try {
      await archiveAccount({ variables: { id: account.id } });
      onClose();
    } catch (e: unknown) {
      setServerError(e instanceof Error ? e.message : 'Failed to archive account');
    }
  };

  const handleDeleteKeepHistory = async () => {
    setServerError('');
    try {
      await deleteAccount({ variables: { id: account.id, option: 'KEEP_HISTORY' } });
      onClose();
    } catch (e: unknown) {
      setServerError(e instanceof Error ? e.message : 'Failed to delete account');
    }
  };

  const handleDeleteAll = async () => {
    setServerError('');
    try {
      await deleteAccount({ variables: { id: account.id, option: 'DELETE_ALL' } });
      onClose();
    } catch (e: unknown) {
      setServerError(e instanceof Error ? e.message : 'Failed to delete account');
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 200,
        }}
      />

      {/* Menu card */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '24px',
          width: '320px',
          zIndex: 201,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '16px' }}>{account.name}</h2>

        {serverError && (
          <p style={{ color: '#EF4444', fontSize: '13px', margin: 0 }}>{serverError}</p>
        )}

        <button
          onClick={handleArchive}
          disabled={isLoading}
          style={{
            padding: '10px 16px',
            borderRadius: '8px',
            border: '1px solid #D1D5DB',
            background: '#fff',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            textAlign: 'left',
            opacity: isLoading ? 0.7 : 1,
          }}
        >
          Archive
        </button>

        <button
          onClick={handleDeleteKeepHistory}
          disabled={isLoading}
          style={{
            padding: '10px 16px',
            borderRadius: '8px',
            border: '1px solid #D1D5DB',
            background: '#fff',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            textAlign: 'left',
            opacity: isLoading ? 0.7 : 1,
          }}
        >
          Delete, keep history
        </button>

        <button
          onClick={() => setShowDeleteAllConfirm(true)}
          disabled={isLoading}
          style={{
            padding: '10px 16px',
            borderRadius: '8px',
            border: '1px solid #EF4444',
            background: '#fff',
            color: '#EF4444',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            textAlign: 'left',
            opacity: isLoading ? 0.7 : 1,
          }}
        >
          Delete everything
        </button>

        <button
          onClick={onClose}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: '1px solid #D1D5DB',
            background: '#fff',
            cursor: 'pointer',
            fontSize: '13px',
            color: '#6B7280',
          }}
        >
          Cancel
        </button>
      </div>

      {/* Delete-all confirmation dialog */}
      {showDeleteAllConfirm && (
        <>
          <div
            onClick={() => setShowDeleteAllConfirm(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              zIndex: 202,
            }}
          />
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%,-50%)',
              backgroundColor: '#fff',
              borderRadius: '12px',
              padding: '24px',
              width: '320px',
              zIndex: 203,
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <h2 style={{ margin: 0, fontSize: '16px', color: '#111827' }}>
              Delete everything?
            </h2>
            <p style={{ margin: 0, fontSize: '14px', color: '#6B7280', lineHeight: '1.5' }}>
              This will permanently erase all transaction history. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteAllConfirm(false)}
                disabled={deleting}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #D1D5DB',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={deleting}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#EF4444',
                  color: '#fff',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.7 : 1,
                }}
              >
                {deleting ? 'Deleting...' : 'Delete everything'}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
