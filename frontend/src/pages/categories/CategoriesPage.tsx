import { useState } from 'react';
import { gql } from '@apollo/client';
import { useExpenseCategories } from '../../entities/category';
import { useIncomeSources } from '../../entities/category';
import { EXPENSE_CATEGORIES_QUERY, INCOME_SOURCES_QUERY } from '../../entities/category';
import type { Category } from '../../entities/category';
import { ACCOUNT_ICONS } from '../../shared/lib/account-icons';
import { CreateCategoryModal } from '../../features/category/create-category';
import { EditCategoryModal } from '../../features/category/edit-category';
import { DeleteCategoryConfirm } from '../../features/category/delete-category';

const CREATE_EXPENSE_CATEGORY = gql`
  mutation CreateExpenseCategory($input: CreateCategoryInput!) {
    createExpenseCategory(input: $input) {
      id name icon createdAt
    }
  }
`;

const CREATE_INCOME_SOURCE = gql`
  mutation CreateIncomeSource($input: CreateCategoryInput!) {
    createIncomeSource(input: $input) {
      id name icon createdAt
    }
  }
`;

const UPDATE_EXPENSE_CATEGORY = gql`
  mutation UpdateExpenseCategory($id: ID!, $input: UpdateCategoryInput!) {
    updateExpenseCategory(id: $id, input: $input) { id name icon createdAt }
  }
`;

const UPDATE_INCOME_SOURCE = gql`
  mutation UpdateIncomeSource($id: ID!, $input: UpdateCategoryInput!) {
    updateIncomeSource(id: $id, input: $input) { id name icon createdAt }
  }
`;

const DELETE_EXPENSE_CATEGORY = gql`
  mutation DeleteExpenseCategory($id: ID!) { deleteExpenseCategory(id: $id) }
`;

const DELETE_INCOME_SOURCE = gql`
  mutation DeleteIncomeSource($id: ID!) { deleteIncomeSource(id: $id) }
`;

interface CategoryRowProps {
  item: Category;
  onEdit: (item: Category) => void;
  onDelete: (item: Category) => void;
}

function CategoryRow({ item, onEdit, onDelete }: CategoryRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px',
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        marginBottom: '8px',
      }}
    >
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          backgroundColor: '#F3F4F6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          flexShrink: 0,
        }}
      >
        {ACCOUNT_ICONS[item.icon] ?? '🏷️'}
      </div>
      <span style={{ fontWeight: 600, fontSize: '14px', flex: 1 }}>{item.name}</span>
      <button
        onClick={() => onEdit(item)}
        style={{
          fontSize: '12px',
          cursor: 'pointer',
          background: 'none',
          border: 'none',
          color: '#4F46E5',
          padding: '4px 6px',
        }}
      >
        Edit
      </button>
      <button
        onClick={() => onDelete(item)}
        style={{
          fontSize: '12px',
          cursor: 'pointer',
          background: 'none',
          border: 'none',
          color: '#EF4444',
          padding: '4px 6px',
        }}
      >
        Delete
      </button>
    </div>
  );
}

interface CategorySectionProps {
  heading: string;
  items: Category[];
  onAdd: () => void;
  onEdit: (item: Category) => void;
  onDelete: (item: Category) => void;
}

function CategorySection({ heading, items, onAdd, onEdit, onDelete }: CategorySectionProps) {
  return (
    <section style={{ marginBottom: '32px' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px', color: '#111827' }}>
        {heading}
      </h2>
      {items.length === 0 && (
        <p style={{ color: '#9CA3AF', fontSize: '14px', marginBottom: '8px' }}>
          No items yet. Tap + to add one.
        </p>
      )}
      {items.map((item) => (
        <CategoryRow key={item.id} item={item} onEdit={onEdit} onDelete={onDelete} />
      ))}
      <button
        onClick={onAdd}
        style={{
          background: '#4F46E5',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          padding: '6px 14px',
          cursor: 'pointer',
          fontSize: '13px',
        }}
      >
        +
      </button>
    </section>
  );
}

export function CategoriesPage() {
  const { categories, loading: expenseLoading, error: expenseError } = useExpenseCategories();
  const { sources, loading: incomeLoading, error: incomeError } = useIncomeSources();

  const [showExpenseCreate, setShowExpenseCreate] = useState(false);
  const [showIncomeCreate, setShowIncomeCreate] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Category | null>(null);
  const [editingIncome, setEditingIncome] = useState<Category | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Category | null>(null);
  const [deletingIncome, setDeletingIncome] = useState<Category | null>(null);

  if (expenseLoading || incomeLoading) return <p>Loading...</p>;
  if (expenseError || incomeError) return <p>Error loading categories.</p>;

  return (
    <main style={{ padding: '24px' }}>
      <h1 style={{ marginBottom: '24px' }}>Categories</h1>
      <CategorySection
        heading="Expense Categories"
        items={categories}
        onAdd={() => setShowExpenseCreate(true)}
        onEdit={setEditingExpense}
        onDelete={setDeletingExpense}
      />
      <CategorySection
        heading="Income Sources"
        items={sources}
        onAdd={() => setShowIncomeCreate(true)}
        onEdit={setEditingIncome}
        onDelete={setDeletingIncome}
      />

      {showExpenseCreate && (
        <CreateCategoryModal
          onClose={() => setShowExpenseCreate(false)}
          mutationDocument={CREATE_EXPENSE_CATEGORY}
          refetchQuery={EXPENSE_CATEGORIES_QUERY}
          title="Add Expense Category"
        />
      )}
      {showIncomeCreate && (
        <CreateCategoryModal
          onClose={() => setShowIncomeCreate(false)}
          mutationDocument={CREATE_INCOME_SOURCE}
          refetchQuery={INCOME_SOURCES_QUERY}
          title="Add Income Source"
        />
      )}

      {editingExpense && (
        <EditCategoryModal
          category={editingExpense}
          onClose={() => setEditingExpense(null)}
          mutationDocument={UPDATE_EXPENSE_CATEGORY}
          refetchQuery={EXPENSE_CATEGORIES_QUERY}
        />
      )}
      {editingIncome && (
        <EditCategoryModal
          category={editingIncome}
          onClose={() => setEditingIncome(null)}
          mutationDocument={UPDATE_INCOME_SOURCE}
          refetchQuery={INCOME_SOURCES_QUERY}
        />
      )}

      {deletingExpense && (
        <DeleteCategoryConfirm
          categoryName={deletingExpense.name}
          categoryId={deletingExpense.id}
          onClose={() => setDeletingExpense(null)}
          mutationDocument={DELETE_EXPENSE_CATEGORY}
          refetchQuery={EXPENSE_CATEGORIES_QUERY}
        />
      )}
      {deletingIncome && (
        <DeleteCategoryConfirm
          categoryName={deletingIncome.name}
          categoryId={deletingIncome.id}
          onClose={() => setDeletingIncome(null)}
          mutationDocument={DELETE_INCOME_SOURCE}
          refetchQuery={INCOME_SOURCES_QUERY}
        />
      )}
    </main>
  );
}
