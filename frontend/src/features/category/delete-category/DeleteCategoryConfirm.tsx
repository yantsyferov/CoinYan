import { useMutation } from '@apollo/client';
import type { DocumentNode } from '@apollo/client';

interface Props {
  categoryName: string;
  categoryId: string;
  onClose: () => void;
  mutationDocument: DocumentNode;
  refetchQuery: DocumentNode;
}

export function DeleteCategoryConfirm({
  categoryName,
  categoryId,
  onClose,
  mutationDocument,
  refetchQuery,
}: Props) {
  const [deleteCategory, { loading }] = useMutation(mutationDocument, {
    refetchQueries: [{ query: refetchQuery }],
  });

  const handleConfirm = async () => {
    try {
      await deleteCategory({ variables: { id: categoryId } });
      onClose();
    } catch {
      // deletion errors are non-recoverable in this context; close anyway
      onClose();
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
          zIndex: 100,
        }}
      />

      {/* Modal card */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '24px',
          width: '340px',
          zIndex: 101,
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
          Delete &laquo;{categoryName}&raquo;?
        </h2>
        <p style={{ margin: 0, fontSize: '14px', color: '#6B7280' }}>
          This action cannot be undone.
        </p>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
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
            onClick={handleConfirm}
            disabled={loading}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              background: '#EF4444',
              color: '#fff',
              cursor: 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </>
  );
}
