import { gql } from '@apollo/client';

export const RESET_PASSWORD_MUTATION = gql`
  mutation ResetPassword($input: ResetPasswordInput!) {
    resetPassword(input: $input) {
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

export interface ResetPasswordData {
  resetPassword: {
    accessToken: string;
    user: { id: string; displayName: string; email: string; createdAt: string };
  };
}

export interface ResetPasswordVariables {
  input: { token: string; newPassword: string };
}
