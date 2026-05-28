import { Transaction } from '../../entities/transaction/model/types';

export interface MonthGroup {
  label: string;
  transactions: Transaction[];
}

export function groupByMonth(transactions: Transaction[]): MonthGroup[] {
  const groupMap = new Map<string, MonthGroup>();
  const order: string[] = [];

  for (const tx of transactions) {
    const isoDate = tx.transactionDate ?? tx.createdAt;
    if (!isoDate) continue;

    const [year, month] = isoDate.split('-').map(Number);
    const key = `${year}-${String(month).padStart(2, '0')}`;

    if (!groupMap.has(key)) {
      const label = new Date(year, month - 1, 1).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      });
      groupMap.set(key, { label, transactions: [] });
      order.push(key);
    }

    groupMap.get(key)!.transactions.push(tx);
  }

  return order.map((key) => groupMap.get(key)!);
}
