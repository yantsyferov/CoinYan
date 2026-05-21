import { gql } from '@apollo/client';

export const ACCOUNT_TRANSACTIONS_QUERY = gql`
  query AccountTransactions($accountId: ID!) {
    accountTransactions(accountId: $accountId) {
      id
      type
      amount
      accountId
      expenseCategoryId
      incomeSourceId
      toAccountId
      fromAccountId
      transferPeerId
      note
      createdAt
    }
  }
`;

export const EXPENSE_CATEGORY_TRANSACTIONS_QUERY = gql`
  query ExpenseCategoryTransactions($categoryId: ID!) {
    expenseCategoryTransactions(categoryId: $categoryId) {
      id
      type
      amount
      accountId
      expenseCategoryId
      incomeSourceId
      note
      createdAt
    }
  }
`;

export const INCOME_SOURCE_TRANSACTIONS_QUERY = gql`
  query IncomeSourceTransactions($sourceId: ID!) {
    incomeSourceTransactions(sourceId: $sourceId) {
      id
      type
      amount
      accountId
      expenseCategoryId
      incomeSourceId
      note
      createdAt
    }
  }
`;
