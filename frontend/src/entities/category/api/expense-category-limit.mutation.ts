import { gql } from '@apollo/client';

export const SET_EXPENSE_CATEGORY_LIMIT_MUTATION = gql`
  mutation SetExpenseCategoryLimit($id: ID!, $monthlyLimit: Float) {
    setExpenseCategoryLimit(id: $id, monthlyLimit: $monthlyLimit) {
      id
      name
      icon
      createdAt
      total
      monthlyLimit
    }
  }
`;
