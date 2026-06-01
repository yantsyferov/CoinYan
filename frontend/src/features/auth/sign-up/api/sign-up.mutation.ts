import { gql } from '@apollo/client';

export const SIGN_UP_MUTATION = gql`
  mutation SignUp($input: SignUpInput!) {
    signUp(input: $input) {
      accessToken
      user {
        id
        displayName
        email
        baseCurrency
        createdAt
      }
    }
  }
`;

export interface SignUpUser {
  id: string;
  displayName: string;
  email: string;
  baseCurrency: string;
  createdAt: string;
}

export interface SignUpData {
  signUp: {
    accessToken: string;
    user: SignUpUser;
  };
}

export interface SignUpVariables {
  input: {
    displayName: string;
    email: string;
    password: string;
    baseCurrency?: string;
  };
}
