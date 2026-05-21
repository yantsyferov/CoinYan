import { useQuery } from '@apollo/client';
import { ME_QUERY } from '../api/me.query';
import type { User } from '../model/types';

interface MeData {
  me: User | null;
}

export function useCurrentUser() {
  const { data, loading, error } = useQuery<MeData>(ME_QUERY);
  return {
    user: data?.me ?? null,
    loading,
    error,
  };
}
