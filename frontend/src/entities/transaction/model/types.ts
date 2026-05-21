export interface Transaction {
  id: string;
  type: 'expense' | 'income' | 'transfer';
  amount: number;
  accountAmount: number;
  accountCurrency: string;
  exchangeRate: number;
  accountId: string;
  expenseCategoryId?: string | null;
  incomeSourceId?: string | null;
  toAccountId?: string;
  fromAccountId?: string;
  transferPeerId?: string;
  note?: string | null;
  createdAt: string;
}
