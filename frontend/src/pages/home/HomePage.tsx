import { useState, useRef, useCallback } from 'react';
import { gql } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { useAccounts } from '../../entities/account';
import { useExpenseCategories, useIncomeSources } from '../../entities/category';
import { EXPENSE_CATEGORIES_QUERY, INCOME_SOURCES_QUERY } from '../../entities/category';
import { CreateAccountModal } from '../../features/account/create-account/CreateAccountModal';
import { CreateCategoryModal } from '../../features/category/create-category/CreateCategoryModal';

const CREATE_EXPENSE_CATEGORY = gql`
  mutation CreateExpenseCategory($input: CreateCategoryInput!) {
    createExpenseCategory(input: $input) { id name icon createdAt }
  }
`;

const CREATE_INCOME_SOURCE = gql`
  mutation CreateIncomeSource($input: CreateCategoryInput!) {
    createIncomeSource(input: $input) { id name icon createdAt }
  }
`;
import { ACCOUNT_ICONS } from '../../shared/lib/account-icons';
import { formatCurrency } from '../../shared/lib/format-currency';
import { CircleItem } from '../../shared/ui/CircleItem';
import { TransactionModal } from '../../features/transaction/TransactionModal';
import { TransferModal } from '../../features/transaction/TransferModal';
import type { Account } from '../../entities/account';
import type { Category } from '../../entities/category';

interface PendingTransaction {
  type: 'expense' | 'income';
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  accountCurrency: string;
}

// ---- Draggable Account Item ----
function DraggableAccountItem({
  account,
  isDropHighlighted,
  activeId,
  onTap,
}: {
  account: Account;
  isDropHighlighted: boolean;
  activeId: string | null;
  onTap: (account: Account) => void;
}) {
  const draggableId = `account:${account.id}`;
  const droppableId = `account-drop:${account.id}`;

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({ id: draggableId });

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: droppableId });

  // Merge both refs into one callback ref
  const mergedRef = useCallback(
    (node: HTMLDivElement | null) => {
      setDragRef(node);
      setDropRef(node);
    },
    [setDragRef, setDropRef],
  );

  // Determine if this account should be highlighted as a drop target
  const shouldHighlight =
    isDropHighlighted && activeId !== null && activeId.startsWith('income:') && (isOver || false);

  const wasDraggingRef = useRef(false);

  const handlePointerDown = () => {
    wasDraggingRef.current = false;
  };

  const handleClick = () => {
    if (wasDraggingRef.current) return;
    onTap(account);
  };

  // Mark as was-dragging once drag starts by checking isDragging
  // We rely on the global wasDragging ref in HomePage instead
  const icon = ACCOUNT_ICONS[account.icon] ?? '💰';
  const balanceStr = formatCurrency(account.currentBalance, account.currency);

  return (
    <div onPointerDown={handlePointerDown} onClick={handleClick}>
      <CircleItem
        icon={icon}
        name={account.name}
        subtitle={balanceStr}
        highlighted={shouldHighlight}
        isDragging={isDragging}
        dragRef={mergedRef}
        dragListeners={listeners as Record<string, unknown>}
        dragAttributes={attributes as Record<string, unknown>}
      />
    </div>
  );
}

// ---- Draggable Income Source Item ----
function DraggableIncomeItem({
  source,
  onTap,
}: {
  source: Category;
  onTap: (source: Category) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `income:${source.id}`,
  });

  const wasDraggingRef = useRef(false);

  const handlePointerDown = () => {
    wasDraggingRef.current = false;
  };

  const handleClick = () => {
    if (wasDraggingRef.current) return;
    onTap(source);
  };

  const icon = ACCOUNT_ICONS[source.icon] ?? source.icon ?? '💹';
  const subtitle = formatCurrency(source.total ?? 0);

  return (
    <div onPointerDown={handlePointerDown} onClick={handleClick}>
      <CircleItem
        icon={icon}
        name={source.name}
        subtitle={subtitle}
        isDragging={isDragging}
        dragRef={setNodeRef}
        dragListeners={listeners as Record<string, unknown>}
        dragAttributes={attributes as Record<string, unknown>}
      />
    </div>
  );
}

// ---- Droppable Expense Category Item ----
function DroppableExpenseItem({
  category,
  activeId,
  onTap,
}: {
  category: Category;
  activeId: string | null;
  onTap: (category: Category) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `category:${category.id}` });

  const shouldHighlight =
    activeId !== null && activeId.startsWith('account:') && (isOver || false);

  const icon = ACCOUNT_ICONS[category.icon] ?? category.icon ?? '🧾';
  const subtitle = formatCurrency(category.total ?? 0);

  return (
    <div onClick={() => onTap(category)}>
      <CircleItem
        icon={icon}
        name={category.name}
        subtitle={subtitle}
        highlighted={shouldHighlight}
        dragRef={setNodeRef}
      />
    </div>
  );
}

// ---- Drag Overlay content ----
function ActiveDragItem({
  activeId,
  accounts,
  incomeSources,
}: {
  activeId: string;
  accounts: Account[];
  incomeSources: Category[];
}) {
  if (activeId.startsWith('account:')) {
    const account = accounts.find((a) => a.id === activeId.replace('account:', ''));
    if (!account) return null;
    return (
      <CircleItem
        icon={ACCOUNT_ICONS[account.icon] ?? '💰'}
        name={account.name}
        subtitle={formatCurrency(account.currentBalance, account.currency)}
      />
    );
  }
  if (activeId.startsWith('income:')) {
    const source = incomeSources.find((s) => s.id === activeId.replace('income:', ''));
    if (!source) return null;
    return (
      <CircleItem
        icon={ACCOUNT_ICONS[source.icon] ?? source.icon ?? '💹'}
        name={source.name}
        subtitle={formatCurrency(source.total ?? 0)}
      />
    );
  }
  return null;
}

// ---- Plus button ----
function PlusButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 48,
        height: 48,
        borderRadius: 9999,
        background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
        color: '#fff',
        fontSize: 22,
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(124,58,237,0.35)',
        flexShrink: 0,
      }}
    >
      +
    </button>
  );
}

// ---- Section ----
function Section({
  title,
  wrap = false,
  onAdd,
  children,
}: {
  title: string;
  wrap?: boolean;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        backgroundColor: '#fff',
        borderRadius: 16,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        marginBottom: 16,
        padding: 20,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <h2
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: '#0F172A',
            margin: 0,
          }}
        >
          {title}
        </h2>
        <PlusButton onClick={onAdd} />
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: wrap ? 'wrap' : 'nowrap',
          gap: 16,
          overflowX: wrap ? 'visible' : 'auto',
          paddingBottom: 4,
          alignItems: 'flex-start',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ---- HomePage ----
export function HomePage() {
  const navigate = useNavigate();
  const { accounts, loading: loadingAccounts } = useAccounts();
  const { categories: expenseCategories, loading: loadingExpense } = useExpenseCategories();
  const { sources: incomeSources, loading: loadingIncome } = useIncomeSources();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingTransaction, setPendingTransaction] = useState<PendingTransaction | null>(null);
  const [pendingTransfer, setPendingTransfer] = useState<{ fromAccount: Account; toAccount: Account } | null>(null);
  const [openModal, setOpenModal] = useState<'account' | 'income' | 'expense' | null>(null);

  // Track whether a drag just completed to suppress click navigation
  const wasDraggingRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    wasDraggingRef.current = true;
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);

    // Reset wasDragging after a brief delay so click handler sees it
    setTimeout(() => {
      wasDraggingRef.current = false;
    }, 100);

    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    // Expense: account dragged onto expense category
    if (activeIdStr.startsWith('account:') && overIdStr.startsWith('category:')) {
      const accountId = activeIdStr.replace('account:', '');
      const categoryId = overIdStr.replace('category:', '');
      const account = accounts.find((a) => a.id === accountId);
      const category = expenseCategories.find((c) => c.id === categoryId);
      if (account && category) {
        setPendingTransaction({
          type: 'expense',
          fromId: accountId,
          fromName: account.name,
          toId: categoryId,
          toName: category.name,
          accountCurrency: account.currency,
        });
      }
    }

    // Transfer: account dragged onto another account
    if (activeIdStr.startsWith('account:') && overIdStr.startsWith('account-drop:')) {
      const fromAccountId = activeIdStr.replace('account:', '');
      const toAccountId = overIdStr.replace('account-drop:', '');
      if (fromAccountId === toAccountId) return;
      const fromAccount = accounts.find((a) => a.id === fromAccountId);
      const toAccount = accounts.find((a) => a.id === toAccountId);
      if (fromAccount && toAccount) {
        setPendingTransfer({ fromAccount, toAccount });
      }
    }

    // Income: income source dragged onto account
    if (activeIdStr.startsWith('income:') && overIdStr.startsWith('account-drop:')) {
      const sourceId = activeIdStr.replace('income:', '');
      const accountId = overIdStr.replace('account-drop:', '');
      const source = incomeSources.find((s) => s.id === sourceId);
      const account = accounts.find((a) => a.id === accountId);
      if (source && account) {
        setPendingTransaction({
          type: 'income',
          fromId: sourceId,
          fromName: source.name,
          toId: accountId,
          toName: account.name,
          accountCurrency: account.currency,
        });
      }
    }
  };

  const handleAccountTap = (account: Account) => {
    if (wasDraggingRef.current) return;
    navigate(`/accounts/${account.id}`);
  };

  const handleIncomeTap = (source: Category) => {
    if (wasDraggingRef.current) return;
    navigate(`/categories/income/${source.id}`);
  };

  const handleExpenseTap = (category: Category) => {
    if (wasDraggingRef.current) return;
    navigate(`/categories/expense/${category.id}`);
  };

  const isLoading = loadingAccounts || loadingExpense || loadingIncome;

  return (
    <div style={{ backgroundColor: '#F1F5F9', minHeight: '100vh', paddingBottom: 32 }}>
      {/* Top bar */}
      <div
        style={{
          backgroundColor: '#fff',
          boxShadow: '0 1px 0 #E2E8F0',
          padding: '0 20px',
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <span
          style={{
            fontSize: 20,
            fontWeight: 800,
            background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          CoinYan
        </span>
        <button
          onClick={() => navigate('/profile')}
          style={{
            width: 36,
            height: 36,
            borderRadius: 9999,
            background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            fontSize: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          👤
        </button>
      </div>

      {/* Page content */}
      <div style={{ padding: '0 16px', maxWidth: 600, margin: '0 auto' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', color: '#94A3B8', paddingTop: 40 }}>Loading...</div>
        ) : (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            {/* Income Sources section */}
            <Section title="Income Sources" wrap onAdd={() => setOpenModal('income')}>
              {incomeSources.map((source) => (
                <DraggableIncomeItem
                  key={source.id}
                  source={source}
                  onTap={handleIncomeTap}
                />
              ))}
            </Section>

            {/* Accounts section */}
            <Section title="Accounts" onAdd={() => setOpenModal('account')}>
              {accounts
                .filter((a) => a.status === 'active')
                .map((account) => (
                  <DraggableAccountItem
                    key={account.id}
                    account={account}
                    isDropHighlighted={activeId !== null && activeId.startsWith('income:')}
                    activeId={activeId}
                    onTap={handleAccountTap}
                  />
                ))}
            </Section>

            {/* Expense Categories section */}
            <Section title="Expense Categories" wrap onAdd={() => setOpenModal('expense')}>
              {expenseCategories.map((category) => (
                <DroppableExpenseItem
                  key={category.id}
                  category={category}
                  activeId={activeId}
                  onTap={handleExpenseTap}
                />
              ))}
            </Section>

            <DragOverlay>
              {activeId ? (
                <ActiveDragItem
                  activeId={activeId}
                  accounts={accounts}
                  incomeSources={incomeSources}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {pendingTransaction && (
        <TransactionModal
          type={pendingTransaction.type}
          fromId={pendingTransaction.fromId}
          fromName={pendingTransaction.fromName}
          toId={pendingTransaction.toId}
          toName={pendingTransaction.toName}
          accountCurrency={pendingTransaction.accountCurrency}
          onClose={() => setPendingTransaction(null)}
        />
      )}

      {pendingTransfer && (
        <TransferModal
          fromAccount={pendingTransfer.fromAccount}
          toAccount={pendingTransfer.toAccount}
          onClose={() => setPendingTransfer(null)}
        />
      )}

      {openModal === 'account' && (
        <CreateAccountModal onClose={() => setOpenModal(null)} />
      )}

      {openModal === 'income' && (
        <CreateCategoryModal
          title="New Income Source"
          mutationDocument={CREATE_INCOME_SOURCE}
          refetchQuery={INCOME_SOURCES_QUERY}
          onClose={() => setOpenModal(null)}
        />
      )}

      {openModal === 'expense' && (
        <CreateCategoryModal
          title="New Expense Category"
          mutationDocument={CREATE_EXPENSE_CATEGORY}
          refetchQuery={EXPENSE_CATEGORIES_QUERY}
          onClose={() => setOpenModal(null)}
        />
      )}
    </div>
  );
}
