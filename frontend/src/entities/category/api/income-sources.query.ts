import { gql } from '@apollo/client';

export const INCOME_SOURCES_QUERY = gql`
  query IncomeSources {
    incomeSources {
      id
      name
      icon
      createdAt
      total
    }
  }
`;
