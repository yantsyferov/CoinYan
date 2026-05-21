import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './auth.setup';

const GQL = 'http://localhost:8001/graphql';
const TEST_EMAIL = 'playwright@test.com';
const TEST_PASSWORD = 'Test1234!';
const EXPENSE_AMOUNT = 50;

async function gql<T>(
  request: import('@playwright/test').APIRequestContext,
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

/** Strip currency symbol and parse to float. Handles "$-50.00", "-$50.00", "$50.00" etc. */
function parseCurrencyText(text: string | null): number {
  if (!text) return 0;
  // Remove everything except digits, dot, and minus
  const cleaned = text.replace(/[^0-9.\-]/g, '');
  // handle edge case: multiple minus signs (shouldn't happen but guard anyway)
  const match = cleaned.match(/^-?\d+\.?\d*$/);
  return match ? parseFloat(match[0]) : 0;
}

test('cancel an expense transaction from the account detail page', async ({ page, request }) => {
  // ── Step 1: Sign in via UI ──────────────────────────────────────────────
  await loginAsTestUser(page);
  await expect(page).toHaveURL(/\/$/);

  // ── Step 2: Get token + IDs + create expense via API ───────────────────
  const signInData = await gql<{ signIn: { accessToken: string } }>(
    request,
    `mutation { signIn(input: { email: "${TEST_EMAIL}", password: "${TEST_PASSWORD}" }) { accessToken } }`,
  );
  const token = signInData.signIn.accessToken;
  expect(token).toBeTruthy();

  // Get active accounts (archived/deleted accounts won't render on the detail page)
  const accountsData = await gql<{
    accounts: Array<{ id: string; name: string; currentBalance: number; currency: string; status: string }>;
  }>(request, '{ accounts { id name currentBalance currency status } }', undefined, token);

  const activeAccounts = accountsData.accounts.filter((a) => a.status === 'active');
  expect(activeAccounts.length).toBeGreaterThan(0);
  const account = activeAccounts[0];
  const accountId = account.id;

  // Get expense categories
  const catData = await gql<{ expenseCategories: Array<{ id: string; name: string }> }>(
    request,
    '{ expenseCategories { id name } }',
    undefined,
    token,
  );
  expect(catData.expenseCategories.length).toBeGreaterThan(0);
  const categoryId = catData.expenseCategories[0].id;

  // Create the expense transaction with a unique note per run
  const uniqueNote = `pw-test-${Date.now()}`;
  const createData = await gql<{
    createExpenseTransaction: { id: string; amount: number; accountId: string };
  }>(
    request,
    `mutation CreateExpenseTransaction($input: CreateExpenseTransactionInput!) {
       createExpenseTransaction(input: $input) { id amount accountId }
     }`,
    {
      input: {
        accountId,
        expenseCategoryId: categoryId,
        amount: EXPENSE_AMOUNT,
        accountAmount: EXPENSE_AMOUNT,
        accountCurrency: 'USD',
        exchangeRate: 1.0,
        note: uniqueNote,
      },
    },
    token,
  );
  expect(createData.createExpenseTransaction.id).toBeTruthy();

  // ── Step 3: Navigate to the account detail page ─────────────────────────
  await page.goto(`/accounts/${accountId}`);
  await page.waitForLoadState('networkidle');

  // ── Step 4: Capture the balance before cancellation ─────────────────────
  // The balance element is a div inside the account header card.
  // It renders as e.g. "$-50.00" or "$0.00" with large purple text.
  // We locate it by finding the unique note row first, then the balance nearby.
  // For robustness, get the balance text directly from the API-known value + what's on screen.

  // Find balance: the header card has [account name, balance, Edit button].
  // The balance div has fontSize 26, fontWeight 800 inline styles — but we can't select by style.
  // Strategy: find the div that is a sibling of the account name div, contains a $ sign,
  // and whose text matches a currency format.
  const accountNameEl = page.getByText(account.name, { exact: true }).first();
  await expect(accountNameEl).toBeVisible({ timeout: 10_000 });

  // The balance sits right after the account name in the DOM.
  // Use the account name element's parent's parent to scope our balance search.
  // Structure: headerCard > div[flex:1] > [accountName div, balance div]
  const balanceEl = accountNameEl.locator('..').locator('div', {
    hasText: /^\$[0-9,.+-]+$/,
  }).first();

  await expect(balanceEl).toBeVisible({ timeout: 10_000 });
  const balanceTextBefore = (await balanceEl.textContent()) ?? '';
  const balanceBefore = parseCurrencyText(balanceTextBefore);

  // ── Step 5: Find and click the specific expense row ──────────────────────
  // We use the unique note text to identify exactly the right row.
  const expenseRow = page.locator('[role="button"]').filter({
    hasText: uniqueNote,
  }).first();

  await expect(expenseRow).toBeVisible({ timeout: 10_000 });
  await expenseRow.click();

  // ── Step 6: Assert dialog is visible ────────────────────────────────────
  const dialogTitle = page.locator('h3', { hasText: 'Cancel transaction?' });
  await expect(dialogTitle).toBeVisible({ timeout: 5_000 });

  // ── Step 7: Assert dialog shows the amount ──────────────────────────────
  // Dialog body shows e.g. "Expense · $50.00"
  const dialogContent = page.locator('div').filter({ hasText: 'Cancel transaction?' }).last();
  await expect(dialogContent).toContainText('50');

  // ── Step 8: Click "Cancel transaction" button ───────────────────────────
  const cancelBtn = page.getByRole('button', { name: 'Cancel transaction' });
  await expect(cancelBtn).toBeVisible();
  await cancelBtn.click();

  // ── Step 9: Assert the expense row is gone ──────────────────────────────
  // Wait for the dialog to close
  await expect(dialogTitle).not.toBeVisible({ timeout: 10_000 });
  // Wait for the specific row to disappear
  await expect(expenseRow).not.toBeVisible({ timeout: 15_000 });

  // ── Step 10: Assert the balance increased by EXPENSE_AMOUNT ─────────────
  await expect(balanceEl).toBeVisible({ timeout: 10_000 });
  const balanceTextAfter = (await balanceEl.textContent()) ?? '';
  const balanceAfter = parseCurrencyText(balanceTextAfter);

  expect(balanceAfter).toBeCloseTo(balanceBefore + EXPENSE_AMOUNT, 1);
});
