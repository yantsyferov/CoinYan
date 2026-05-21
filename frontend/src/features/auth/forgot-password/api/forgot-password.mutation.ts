import { gql } from '@apollo/client';

export const FORGOT_PASSWORD_MUTATION = gql`
  mutation ForgotPassword($email: String!) {
    forgotPassword(email: $email)
  }
`;

export interface ForgotPasswordData {
  forgotPassword: boolean;
}

export interface ForgotPasswordVariables {
  email: string;
}
