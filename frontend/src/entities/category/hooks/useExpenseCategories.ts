import { useQuery } from '@apollo/client';
import { EXPENSE_CATEGORIES_QUERY } from '../api/expense-categories.query';
import type { Category } from '../model/types';

interface ExpenseCategoriesData {
  expenseCategories: Category[];
}

export function useExpenseCategories() {
  const { data, loading, error, refetch } = useQuery<ExpenseCategoriesData>(
    EXPENSE_CATEGORIES_QUERY,
    { fetchPolicy: 'cache-and-network' },
  );
  return {
    categories: data?.expenseCategories ?? [],
    loading,
    error,
    refetch,
  };
}
