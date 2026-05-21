import { useQuery } from '@apollo/client';
import { INCOME_SOURCES_QUERY } from '../api/income-sources.query';
import type { Category } from '../model/types';

interface IncomeSourcesData {
  incomeSources: Category[];
}

export function useIncomeSources() {
  const { data, loading, error, refetch } = useQuery<IncomeSourcesData>(INCOME_SOURCES_QUERY, {
    fetchPolicy: 'cache-and-network',
  });
  return {
    sources: data?.incomeSources ?? [],
    loading,
    error,
    refetch,
  };
}
