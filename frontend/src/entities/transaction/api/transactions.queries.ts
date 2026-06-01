import { gql } from '@apollo/client';

export const ACCOUNT_TRANSACTIONS_QUERY = gql`
  query AccountTransactions($accountId: ID!, $limit: Int = 50, $offset: Int = 0) {
    accountTransactions(accountId: $accountId, limit: $limit, offset: $offset) {
      id
      type
      amount
      accountAmount
      exchangeRate
      rateIsCustom
      sourceCurrency
      targetCurrency
      accountId
      expenseCategoryId
      incomeSourceId
      toAccountId
      fromAccountId
      transferPeerId
      note
      createdAt
      transactionDate
      baseCurrencyCode
      baseCurrencyRate
      baseCurrencyAmount
    }
  }
`;

export const EXPENSE_CATEGORY_TRANSACTIONS_QUERY = gql`
  query ExpenseCategoryTransactions($categoryId: ID!, $limit: Int = 50, $offset: Int = 0) {
    expenseCategoryTransactions(categoryId: $categoryId, limit: $limit, offset: $offset) {
      id
      type
      amount
      accountAmount
      exchangeRate
      rateIsCustom
      sourceCurrency
      targetCurrency
      accountId
      expenseCategoryId
      incomeSourceId
      note
      createdAt
      transactionDate
      baseCurrencyCode
      baseCurrencyRate
      baseCurrencyAmount
    }
  }
`;

export const INCOME_SOURCE_TRANSACTIONS_QUERY = gql`
  query IncomeSourceTransactions($sourceId: ID!, $limit: Int = 50, $offset: Int = 0) {
    incomeSourceTransactions(sourceId: $sourceId, limit: $limit, offset: $offset) {
      id
      type
      amount
      accountAmount
      exchangeRate
      rateIsCustom
      sourceCurrency
      targetCurrency
      accountId
      expenseCategoryId
      incomeSourceId
      note
      createdAt
      transactionDate
      baseCurrencyCode
      baseCurrencyRate
      baseCurrencyAmount
    }
  }
`;
