import { gql } from '@apollo/client';

export const SIGN_IN_MUTATION = gql`
  mutation SignIn($input: SignInInput!) {
    signIn(input: $input) {
      accessToken
      user {
        id
        displayName
        email
        createdAt
      }
    }
  }
`;

export interface SignInData {
  signIn: {
    accessToken: string;
    user: {
      id: string;
      displayName: string;
      email: string;
      createdAt: string;
    };
  };
}

export interface SignInVariables {
  input: {
    email: string;
    password: string;
  };
}
