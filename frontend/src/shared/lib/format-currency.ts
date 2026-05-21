const SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CHF: 'Fr',
  RUB: '₽',
  UAH: '₴',
};

export function formatCurrency(amount: number, currency?: string): string {
  const symbol = currency ? (SYMBOLS[currency] ?? `${currency} `) : '$';
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted}`;
}
