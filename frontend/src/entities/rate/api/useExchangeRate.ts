import { gql, useQuery } from '@apollo/client';

export const EXCHANGE_RATE_QUERY = gql`
  query ExchangeRate($from: String!, $to: String!, $date: String) {
    exchangeRate(from: $from, to: $to, date: $date) {
      from
      to
      date
      rate
      stale
    }
  }
`;

interface ExchangeRateResult {
  from: string;
  to: string;
  date: string;
  rate: number;
  stale: boolean;
}

interface ExchangeRateData {
  exchangeRate: ExchangeRateResult;
}

interface ExchangeRateVariables {
  from: string;
  to: string;
  date: string;
}

interface UseExchangeRateResult {
  rate: number | null;
  stale: boolean;
  loading: boolean;
}

export function useExchangeRate(
  from: string,
  to: string,
  date: string,
): UseExchangeRateResult {
  const skip = !from || !to || from === to;

  const { data, loading } = useQuery<ExchangeRateData, ExchangeRateVariables>(
    EXCHANGE_RATE_QUERY,
    {
      variables: { from, to, date },
      skip,
      fetchPolicy: 'cache-and-network',
    },
  );

  if (from === to && from) {
    return { rate: 1.0, stale: false, loading: false };
  }

  if (skip) {
    return { rate: null, stale: false, loading: false };
  }

  if (loading) {
    return { rate: null, stale: false, loading: true };
  }

  if (!data?.exchangeRate) {
    return { rate: null, stale: false, loading: false };
  }

  return {
    rate: data.exchangeRate.rate,
    stale: data.exchangeRate.stale,
    loading: false,
  };
}
