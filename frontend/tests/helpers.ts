import { type APIRequestContext } from '@playwright/test';

export const GQL = 'http://localhost:8001/graphql';
export const TEST_EMAIL = 'playwright@test.com';
export const TEST_PASSWORD = 'Test1234!';

export async function gql<T>(
  request: APIRequestContext,
  query: string,
  variables?: object,
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const resp = await request.post(GQL, { headers, data: { query, variables } });
  const json = await resp.json() as { data: T };
  return json.data;
}

export function parseCurrencyText(text: string | null): number {
  if (!text) return 0;
  const cleaned = text.replace(/[^0-9.\-]/g, '');
  const match = cleaned.match(/^-?\d+\.?\d*$/);
  return match ? parseFloat(match[0]) : 0;
}

export async function getAuthToken(request: APIRequestContext): Promise<string> {
  const data = await gql<{ signIn: { accessToken: string } }>(
    request,
    `mutation { signIn(input: { email: "${TEST_EMAIL}", password: "${TEST_PASSWORD}" }) { accessToken } }`,
  );
  return data.signIn.accessToken;
}

type AccountInfo = { id: string; name: string; currentBalance: number; currency: string; status: string };
type IncomeSourceInfo = { id: string; name: string; total: number };

/** Returns N active accounts. Creates them via API if fewer than N exist. */
export async function ensureActiveAccounts(
  request: APIRequestContext,
  token: string,
  count = 1,
): Promise<AccountInfo[]> {
  const data = await gql<{ accounts: AccountInfo[] }>(
    request,
    '{ accounts { id name currentBalance currency status } }',
    undefined,
    token,
  );
  const active = data.accounts.filter((a) => a.status === 'active');

  const results: AccountInfo[] = [...active];
  for (let i = active.length; i < count; i++) {
    const created = await gql<{ createAccount: AccountInfo }>(
      request,
      `mutation CreateAccount($input: CreateAccountInput!) {
         createAccount(input: $input) { id name currentBalance currency status }
       }`,
      { input: { name: `PW Account ${i + 1}`, icon: 'cash', currency: 'USD', startingBalance: 1000 } },
      token,
    );
    results.push(created.createAccount);
  }

  return results.slice(0, count);
}

/** Returns the first income source. Creates one via API if none exist. */
export async function ensureIncomeSource(
  request: APIRequestContext,
  token: string,
): Promise<IncomeSourceInfo> {
  const data = await gql<{ incomeSources: IncomeSourceInfo[] }>(
    request,
    '{ incomeSources { id name total } }',
    undefined,
    token,
  );
  if (data.incomeSources.length > 0) return data.incomeSources[0];

  const created = await gql<{ createIncomeSource: { id: string; name: string } }>(
    request,
    `mutation CreateIncomeSource($input: CreateCategoryInput!) {
       createIncomeSource(input: $input) { id name }
     }`,
    { input: { name: 'PW Salary', icon: 'cash' } },
    token,
  );
  return { ...created.createIncomeSource, total: 0 };
}

/** Returns the first expense category. Creates one via API if none exist. */
export async function ensureExpenseCategory(
  request: APIRequestContext,
  token: string,
): Promise<{ id: string; name: string }> {
  const data = await gql<{ expenseCategories: Array<{ id: string; name: string }> }>(
    request,
    '{ expenseCategories { id name } }',
    undefined,
    token,
  );
  if (data.expenseCategories.length > 0) return data.expenseCategories[0];

  const created = await gql<{ createExpenseCategory: { id: string; name: string } }>(
    request,
    `mutation CreateExpenseCategory($input: CreateCategoryInput!) {
       createExpenseCategory(input: $input) { id name }
     }`,
    { input: { name: 'PW Groceries', icon: 'food' } },
    token,
  );
  return created.createExpenseCategory;
}

export async function createExpenseTransaction(
  request: APIRequestContext,
  token: string,
  accountId: string,
  categoryId: string,
  amount: number,
  note: string,
): Promise<string> {
  const data = await gql<{ createExpenseTransaction: { id: string } }>(
    request,
    `mutation CreateExpenseTransaction($input: CreateExpenseTransactionInput!) {
       createExpenseTransaction(input: $input) { id }
     }`,
    {
      input: {
        accountId,
        expenseCategoryId: categoryId,
        amount,
        accountAmount: amount,
        accountCurrency: 'USD',
        exchangeRate: 1.0,
        note,
      },
    },
    token,
  );
  return data.createExpenseTransaction.id;
}

export async function createIncomeTransaction(
  request: APIRequestContext,
  token: string,
  sourceId: string,
  accountId: string,
  amount: number,
  note: string,
): Promise<string> {
  const data = await gql<{ createIncomeTransaction: { id: string } }>(
    request,
    `mutation CreateIncomeTransaction($input: CreateIncomeTransactionInput!) {
       createIncomeTransaction(input: $input) { id }
     }`,
    {
      input: {
        incomeSourceId: sourceId,
        accountId,
        amount,
        accountAmount: amount,
        accountCurrency: 'USD',
        exchangeRate: 1.0,
        note,
      },
    },
    token,
  );
  return data.createIncomeTransaction.id;
}

export async function createTransferTransaction(
  request: APIRequestContext,
  token: string,
  fromAccountId: string,
  toAccountId: string,
  amount: number,
  note: string,
): Promise<string> {
  const data = await gql<{ createTransferTransaction: { id: string } }>(
    request,
    `mutation CreateTransferTransaction($input: CreateTransferTransactionInput!) {
       createTransferTransaction(input: $input) { id }
     }`,
    {
      input: {
        fromAccountId,
        toAccountId,
        fromAmount: amount,
        toAmount: amount,
        fromCurrency: 'USD',
        toCurrency: 'USD',
        exchangeRate: 1.0,
        note,
      },
    },
    token,
  );
  return data.createTransferTransaction.id;
}
