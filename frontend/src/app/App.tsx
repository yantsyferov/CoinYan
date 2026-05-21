import { Routes, Route } from 'react-router-dom';
import { HomePage } from '../pages/home/HomePage';
import { SignUpPage } from '../pages/sign-up/SignUpPage';
import { SignInPage } from '../pages/sign-in/SignInPage';
import { ForgotPasswordPage } from '../pages/forgot-password/ForgotPasswordPage';
import { ResetPasswordPage } from '../pages/reset-password/ResetPasswordPage';
import { ProfilePage } from '../pages/profile/ProfilePage';
import { ConfirmEmailPage } from '../pages/confirm-email/ConfirmEmailPage';
import { ProtectedRoute } from '../shared/lib/router';
import { AccountsPage } from '../pages/accounts/AccountsPage';
import { AccountDetailPage } from '../pages/accounts/AccountDetailPage';
import { ArchivedAccountsPage } from '../pages/accounts/archived/ArchivedAccountsPage';
import { CategoriesPage } from '../pages/categories/CategoriesPage';
import { ExpenseCategoryDetailPage } from '../pages/categories/ExpenseCategoryDetailPage';
import { IncomeSourceDetailPage } from '../pages/categories/IncomeSourceDetailPage';

export function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/sign-in" element={<SignInPage />} />
      <Route path="/sign-up" element={<SignUpPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/confirm-email" element={<ConfirmEmailPage />} />

      {/* Protected routes — require a valid session */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/accounts/archived" element={<ArchivedAccountsPage />} />
        <Route path="/accounts/:id" element={<AccountDetailPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/categories/expense/:id" element={<ExpenseCategoryDetailPage />} />
        <Route path="/categories/income/:id" element={<IncomeSourceDetailPage />} />
      </Route>
    </Routes>
  );
}
