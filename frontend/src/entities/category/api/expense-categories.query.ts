import { gql } from '@apollo/client';

export const EXPENSE_CATEGORIES_QUERY = gql`
  query ExpenseCategories {
    expenseCategories {
      id
      name
      icon
      createdAt
      currency
      total
      monthlyLimit
    }
  }
`;

export const CATEGORY_TOTALS_BY_CURRENCY_QUERY = gql`
  query CategoryTotalsByCurrency($categoryId: ID!, $month: String!) {
    categoryTotalsByCurrency(categoryId: $categoryId, month: $month) {
      currency
      amount
    }
  }
`;
