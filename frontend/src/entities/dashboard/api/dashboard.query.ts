import { gql } from '@apollo/client';

export const DASHBOARD_QUERY = gql`
  query Dashboard($year: Int, $month: Int) {
    dashboard(year: $year, month: $month) {
      totalIncome
      totalExpenses
      netBalance
      totalAccountBalance
      categories {
        id
        name
        icon
        amount
        share
        monthlyLimit
        budgetPercent
      }
    }
  }
`;

export interface DashboardCategory {
  id: string;
  name: string;
  icon: string;
  amount: number;
  share: number;
  monthlyLimit: number | null;
  budgetPercent: number | null;
}

export interface DashboardSummary {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  totalAccountBalance: number | null;
  categories: DashboardCategory[];
}

export interface DashboardData {
  dashboard: DashboardSummary;
}
