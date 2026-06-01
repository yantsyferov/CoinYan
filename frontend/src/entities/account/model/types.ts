export interface Account {
  id: string;
  name: string;
  icon: string;
  currency: string;
  currentBalance: number;
  status: string;
  deletedAt: string | null;
  createdAt: string;
  balanceInBaseCurrency?: number | null;
  baseCurrency?: string | null;
}
