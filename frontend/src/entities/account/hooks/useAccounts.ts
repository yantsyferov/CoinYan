import { useQuery } from '@apollo/client';
import { ACCOUNTS_QUERY } from '../api/accounts.query';
import type { Account } from '../model/types';

interface AccountsData {
  accounts: Account[];
}

export function useAccounts() {
  const { data, loading, error, refetch } = useQuery<AccountsData>(ACCOUNTS_QUERY, {
    fetchPolicy: 'cache-and-network',
  });
  return {
    accounts: data?.accounts ?? [],
    loading,
    error,
    refetch,
  };
}
