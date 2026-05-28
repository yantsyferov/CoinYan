export interface Category {
  id: string;
  name: string;
  icon: string;
  createdAt: string;
  currency: string;
  total?: number;
  monthlyLimit?: number | null;
}
