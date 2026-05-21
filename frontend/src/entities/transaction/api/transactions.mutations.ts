import { gql } from '@apollo/client';

export const CREATE_EXPENSE_TRANSACTION_MUTATION = gql`
  mutation CreateExpenseTransaction($input: CreateExpenseTransactionInput!) {
    createExpenseTransaction(input: $input) {
      id
      type
      amount
      accountAmount
      accountCurrency
      exchangeRate
      accountId
      expenseCategoryId
      note
      createdAt
    }
  }
`;

export const CREATE_INCOME_TRANSACTION_MUTATION = gql`
  mutation CreateIncomeTransaction($input: CreateIncomeTransactionInput!) {
    createIncomeTransaction(input: $input) {
      id
      type
      amount
      accountAmount
      accountCurrency
      exchangeRate
      accountId
      incomeSourceId
      note
      createdAt
    }
  }
`;

export const CREATE_TRANSFER_TRANSACTION_MUTATION = gql`
  mutation CreateTransferTransaction($input: CreateTransferTransactionInput!) {
    createTransferTransaction(input: $input) {
      id
      type
      amount
      accountCurrency
      toAccountId
      transferPeerId
      createdAt
    }
  }
`;

export const CANCEL_TRANSACTION_MUTATION = gql`
  mutation CancelTransaction($id: ID!) {
    cancelTransaction(id: $id)
  }
`;
