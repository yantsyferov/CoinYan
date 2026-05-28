import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './auth.setup';
import {
  gql,
  getAuthToken,
  ensureExpenseCategory,
  ensureIncomeSource,
} from './helpers';

// Dates chosen to span two distinct calendar months.
const CURRENT_MONTH_DATE = '2026-05-15';
const PRIOR_MONTH_DATE = '2026-04-10';

// The year string that must appear in both month headers regardless of locale.
const YEAR_STRING = '2026';

/**
 * Creates a fresh account via GraphQL with zero starting balance so that no
 * "Initial balance" transaction is added. Returns id and name.
 */
async function createFreshAccount(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  suffix: string,
): Promise<{ id: string; name: string }> {
  const name = `PW Month-Group ${suffix}`;
  const data = await gql<{ createAccount: { id: string; name: string } }>(
    request,
    `mutation CreateAccount($input: CreateAccountInput!) {
       createAccount(input: $input) { id name }
     }`,
    { input: { name, icon: 'cash', currency: 'USD' } },
    token,
  );
  return data.createAccount;
}

test(
  'account detail page groups transactions by month with correct headers and ordering',
  async ({ page, request }) => {
    // ── Step 1: authenticate ─────────────────────────────────────────────────
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/$/);

    const token = await getAuthToken(request);

    // ── Step 2: create a fresh isolated account (no starting balance) ────────
    const suffix = Date.now().toString();
    const account = await createFreshAccount(request, token, suffix);
    expect(account.id).toBeTruthy();

    // ── Step 3: ensure supporting data exists ────────────────────────────────
    const category = await ensureExpenseCategory(request, token);
    const source = await ensureIncomeSource(request, token);

    // ── Step 4: create one transaction in each of two different months ────────
    const noteCurrentMonth = `pw-may-${suffix}`;
    const notePriorMonth = `pw-apr-${suffix}`;

    // May 2026 expense
    await gql(
      request,
      `mutation CreateExpenseTransaction($input: CreateExpenseTransactionInput!) {
         createExpenseTransaction(input: $input) { id }
       }`,
      {
        input: {
          accountId: account.id,
          expenseCategoryId: category.id,
          amount: 75,
          accountAmount: 75,
          accountCurrency: 'USD',
          exchangeRate: 1.0,
          note: noteCurrentMonth,
          transactionDate: CURRENT_MONTH_DATE,
        },
      },
      token,
    );

    // April 2026 income
    await gql(
      request,
      `mutation CreateIncomeTransaction($input: CreateIncomeTransactionInput!) {
         createIncomeTransaction(input: $input) { id }
       }`,
      {
        input: {
          incomeSourceId: source.id,
          accountId: account.id,
          amount: 200,
          accountAmount: 200,
          accountCurrency: 'USD',
          exchangeRate: 1.0,
          note: notePriorMonth,
          transactionDate: PRIOR_MONTH_DATE,
        },
      },
      token,
    );

    // ── Step 5: navigate to the account detail page ──────────────────────────
    await page.goto(`/accounts/${account.id}`);
    await page.waitForLoadState('networkidle');

    // Confirm we are on the right page
    const accountNameEl = page.getByText(account.name, { exact: true }).first();
    await expect(accountNameEl).toBeVisible({ timeout: 10_000 });

    // ── Step 6: both transaction notes must be visible ───────────────────────
    const currentMonthRow = page
      .locator('[role="button"]')
      .filter({ hasText: noteCurrentMonth })
      .first();
    const priorMonthRow = page
      .locator('[role="button"]')
      .filter({ hasText: notePriorMonth })
      .first();

    await expect(currentMonthRow).toBeVisible({ timeout: 10_000 });
    await expect(priorMonthRow).toBeVisible({ timeout: 10_000 });

    // ── Step 7: locate the month-group header divs ───────────────────────────
    // The AccountDetailPage renders month headers as plain <div> elements with
    // inline style `textTransform: 'uppercase'`. They are rendered by the
    // groupByMonth utility which produces labels like "May 2026" / "май 2026 г.".
    // All such headers contain the four-digit year. We identify them via the
    // CSS property selector which Playwright supports.
    const monthHeaderLocator = page.locator(
      'div[style*="text-transform: uppercase"], div[style*="textTransform"]',
    );

    // Wait until at least 2 headers are present (one per month).
    await expect(monthHeaderLocator).toHaveCount(2, { timeout: 10_000 });

    // ── Step 8: both headers contain the expected year ───────────────────────
    const header0 = monthHeaderLocator.nth(0);
    const header1 = monthHeaderLocator.nth(1);

    await expect(header0).toContainText(YEAR_STRING);
    await expect(header1).toContainText(YEAR_STRING);

    // ── Step 9: headers appear in descending order (most recent first) ────────
    const header0Box = await header0.boundingBox();
    const header1Box = await header1.boundingBox();
    expect(header0Box).not.toBeNull();
    expect(header1Box).not.toBeNull();

    // header0 (May) must be rendered above header1 (April)
    expect(header0Box!.y).toBeLessThan(header1Box!.y);

    // ── Step 10: each header sits above its own month's transactions ──────────
    const currentBox = await currentMonthRow.boundingBox();
    const priorBox = await priorMonthRow.boundingBox();
    expect(currentBox).not.toBeNull();
    expect(priorBox).not.toBeNull();

    // The May header is above the May transaction row
    expect(header0Box!.y).toBeLessThan(currentBox!.y);

    // The April header is above the April transaction row
    expect(header1Box!.y).toBeLessThan(priorBox!.y);

    // The May transaction row appears BEFORE (above) the April row in the DOM
    expect(currentBox!.y).toBeLessThan(priorBox!.y);

    // ── Step 11: headers are not duplicated — exactly two unique months ────────
    const header0Text = (await header0.textContent())?.trim() ?? '';
    const header1Text = (await header1.textContent())?.trim() ?? '';
    expect(header0Text).not.toBe(header1Text);
    expect(header0Text).toContain(YEAR_STRING);
    expect(header1Text).toContain(YEAR_STRING);
  },
);
