import { gql } from '@apollo/client';

export const ACCOUNTS_QUERY = gql`
  query Accounts {
    accounts {
      id
      name
      icon
      currency
      currentBalance
      status
      deletedAt
      createdAt
      balanceInBaseCurrency
      baseCurrency
    }
  }
`;
