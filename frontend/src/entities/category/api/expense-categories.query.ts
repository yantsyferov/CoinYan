import { gql } from '@apollo/client';

export const EXPENSE_CATEGORIES_QUERY = gql`
  query ExpenseCategories {
    expenseCategories {
      id
      name
      icon
      createdAt
      total
    }
  }
`;
