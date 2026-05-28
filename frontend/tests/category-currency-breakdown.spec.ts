/**
 * Slice 9 acceptance test — Category per-currency totals
 *
 * Verifies that when an expense category has transactions in multiple currencies
 * within the current month, the ExpenseCategoryDetailPage shows:
 *   1. The category name (page loaded)
 *   2. A "By currency" section
 *   3. A USD total entry showing the source amount (100)
 *   4. A UAH total entry showing the source amount (500)
 *
 * Setup:
 *   - Create a USD account and a UAH account
 *   - Create a UAH expense category
 *   - Create a cross-currency expense: USD account → UAH category
 *       amount=100 (USD source), accountAmount=4100 (UAH equivalent),
 *       sourceCurrency="USD", targetCurrency="UAH", exchangeRate=41.0
 *   - Create a same-currency expense: UAH account → UAH category
 *       amount=500 (UAH), accountAmount=500, sourceCurrency="UAH", targetCurrency="UAH"
 *
 * The totals-by-currency endpoint groups by source_currency and sums Transaction.amount,
 * so the USD entry will show 100 and the UAH entry will show 500.
 */

import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './auth.setup';
import { gql, getAuthToken } from './helpers';

test.setTimeout(60_000);

const TS = Date.now();
const USD_ACCOUNT_NAME = `S9-USD-Acct-${TS}`;
const UAH_ACCOUNT_NAME = `S9-UAH-Acct-${TS}`;
const UAH_CATEGORY_NAME = `S9-UAH-Cat-${TS}`;

// Current month for transaction dates and the totals-by-currency query
const CURRENT_DATE = '2026-05-28';

// ── API helpers ────────────────────────────────────────────────────────────────

async function createAccount(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  name: string,
  currency: string,
  startingBalance = 10_000,
): Promise<{ id: string }> {
  const data = await gql<{ createAccount: { id: string } }>(
    request,
    `mutation CreateAccount($input: CreateAccountInput!) {
       createAccount(input: $input) { id }
     }`,
    { input: { name, icon: 'cash', currency, startingBalance } },
    token,
  );
  return data.createAccount;
}

async function createExpenseCategory(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  name: string,
  currency: string,
): Promise<{ id: string }> {
  const data = await gql<{ createExpenseCategory: { id: string } }>(
    request,
    `mutation CreateExpenseCategory($input: CreateCategoryInput!) {
       createExpenseCategory(input: $input) { id }
     }`,
    { input: { name, icon: 'cash', currency } },
    token,
  );
  return data.createExpenseCategory;
}

/**
 * Creates an expense transaction.
 *
 * For cross-currency (USD account → UAH category):
 *   amount        = USD source amount (what the totals-by-currency endpoint will sum under "USD")
 *   accountAmount = UAH equivalent (what the account deducts, stored as account_amount)
 *   sourceCurrency = "USD"
 *   targetCurrency = "UAH"
 *
 * For same-currency (UAH account → UAH category):
 *   amount        = UAH amount
 *   accountAmount = UAH amount (same)
 *   sourceCurrency = "UAH"
 *   targetCurrency = "UAH"
 *
 * transactionDate must be provided explicitly to avoid the BFF sending null
 * (which causes a 422 from the transactions service).
 */
async function createExpenseTransaction(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  accountId: string,
  categoryId: string,
  opts: {
    amount: number;
    accountAmount: number;
    accountCurrency: string;
    exchangeRate: number;
    sourceCurrency: string;
    targetCurrency: string;
    note?: string;
  },
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
        amount: opts.amount,
        accountAmount: opts.accountAmount,
        accountCurrency: opts.accountCurrency,
        exchangeRate: opts.exchangeRate,
        sourceCurrency: opts.sourceCurrency,
        targetCurrency: opts.targetCurrency,
        note: opts.note ?? null,
        transactionDate: CURRENT_DATE,
      },
    },
    token,
  );
  return data.createExpenseTransaction.id;
}

async function deleteAccount(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  id: string,
): Promise<void> {
  await gql(
    request,
    `mutation DeleteAccount($id: ID!, $option: DeleteAccountOption!) { deleteAccount(id: $id, option: $option) }`,
    { id, option: 'DELETE_ALL' },
    token,
  );
}

async function deleteExpenseCategory(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  id: string,
): Promise<void> {
  await gql(
    request,
    `mutation DeleteExpenseCategory($id: ID!) { deleteExpenseCategory(id: $id) }`,
    { id },
    token,
  );
}

// ── Test ───────────────────────────────────────────────────────────────────────

test.describe('Slice 9 — Category per-currency totals', () => {
  test('category detail page shows "By currency" section with USD and UAH entries', async ({
    page,
    request,
  }) => {
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/$/);

    const token = await getAuthToken(request);

    // Create test entities
    const usdAccount = await createAccount(request, token, USD_ACCOUNT_NAME, 'USD', 10_000);
    const uahAccount = await createAccount(request, token, UAH_ACCOUNT_NAME, 'UAH', 100_000);
    const category = await createExpenseCategory(request, token, UAH_CATEGORY_NAME, 'UAH');

    // Create cross-currency expense: 100 USD from USD account → UAH category
    // (amount = 100 USD source; totals-by-currency will show "$100.00 USD")
    const crossCurrencyTxnId = await createExpenseTransaction(
      request,
      token,
      usdAccount.id,
      category.id,
      {
        amount: 100,
        accountAmount: 4100,
        accountCurrency: 'USD',
        exchangeRate: 41.0,
        sourceCurrency: 'USD',
        targetCurrency: 'UAH',
        note: `s9-usd-${TS}`,
      },
    );

    // Create same-currency expense: 500 UAH from UAH account → UAH category
    // (amount = 500 UAH source; totals-by-currency will show "₴500.00 UAH")
    const sameCurrencyTxnId = await createExpenseTransaction(
      request,
      token,
      uahAccount.id,
      category.id,
      {
        amount: 500,
        accountAmount: 500,
        accountCurrency: 'UAH',
        exchangeRate: 1.0,
        sourceCurrency: 'UAH',
        targetCurrency: 'UAH',
        note: `s9-uah-${TS}`,
      },
    );

    try {
      // Navigate directly to the category detail page
      await page.goto(`/categories/expense/${category.id}`);
      await page.waitForLoadState('networkidle');

      // ── Assertion 1: Page loaded — category name is visible ────────────────
      await expect(
        page.getByText(UAH_CATEGORY_NAME, { exact: true }),
      ).toBeVisible({ timeout: 15_000 });

      // ── Assertion 2: "By currency" section header is visible ───────────────
      await expect(
        page.getByText('By currency', { exact: true }),
      ).toBeVisible({ timeout: 15_000 });

      // ── Assertion 3: USD entry is visible ─────────────────────────────────
      // Rendered as: "$100.00 USD" (formatCurrency(100, "USD") + " " + "USD")
      const usdEntry = page.getByText(/USD/, { exact: false }).filter({ hasText: /100/ });
      await expect(usdEntry.first()).toBeVisible({ timeout: 10_000 });

      // ── Assertion 4: UAH entry is visible ─────────────────────────────────
      // Rendered as: "₴500.00 UAH" (formatCurrency(500, "UAH") + " " + "UAH")
      const uahEntry = page.getByText(/UAH/, { exact: false }).filter({ hasText: /500/ });
      await expect(uahEntry.first()).toBeVisible({ timeout: 10_000 });
    } finally {
      // Teardown: delete transactions via category+account deletion
      // Deleting accounts with DELETE_ALL removes all linked transactions
      await deleteExpenseCategory(request, token, category.id).catch(() => {});
      await deleteAccount(request, token, usdAccount.id).catch(() => {});
      await deleteAccount(request, token, uahAccount.id).catch(() => {});
    }
  });
});
