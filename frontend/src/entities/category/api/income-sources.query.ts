import { gql } from '@apollo/client';

export const INCOME_SOURCES_QUERY = gql`
  query IncomeSources {
    incomeSources {
      id
      name
      icon
      createdAt
      currency
      total
    }
  }
`;

export const INCOME_TOTALS_BY_CURRENCY_QUERY = gql`
  query IncomeTotalsByCurrency($incomeSourceId: ID!, $month: String!) {
    incomeTotalsByCurrency(incomeSourceId: $incomeSourceId, month: $month) {
      currency
      amount
    }
  }
`;
