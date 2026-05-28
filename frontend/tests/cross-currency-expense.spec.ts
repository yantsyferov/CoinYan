import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './auth.setup';
import { gql, getAuthToken, getCircleByName, performDrag } from './helpers';

// ─── Unique run suffix ─────────────────────────────────────────────────────────
const TS = Date.now();
const USD_ACCOUNT_NAME = `PW-USD-Acct-${TS}`;
const UAH_CATEGORY_NAME = `PW-UAH-Cat-${TS}`;
const USD_CATEGORY_NAME = `PW-USD-Cat-${TS}`;

// ─── API helpers ───────────────────────────────────────────────────────────────

async function createAccount(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  name: string,
  currency: string,
): Promise<{ id: string; name: string; currency: string; currentBalance: number }> {
  // startingBalance: 0 avoids the initial-balance transaction that requires
  // the transactions service to be healthy with a non-zero balance path
  const data = await gql<{
    createAccount: { id: string; name: string; currency: string; currentBalance: number };
  }>(
    request,
    `mutation CreateAccount($input: CreateAccountInput!) {
       createAccount(input: $input) { id name currency currentBalance }
     }`,
    { input: { name, icon: 'cash', currency, startingBalance: 0 } },
    token,
  );
  return data.createAccount;
}

async function createExpenseCategory(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  name: string,
  currency: string,
): Promise<{ id: string; name: string; currency: string }> {
  const data = await gql<{
    createExpenseCategory: { id: string; name: string; currency: string };
  }>(
    request,
    `mutation CreateExpenseCategory($input: CreateCategoryInput!) {
       createExpenseCategory(input: $input) { id name currency }
     }`,
    { input: { name, icon: 'cash', currency } },
    token,
  );
  return data.createExpenseCategory;
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

// ─── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Multi-currency expense — Slice 3 acceptance', () => {
  test('cross-currency: drag USD account onto UAH category shows three-field form, auto-calculates, and creates transaction', async ({
    page,
    request,
  }) => {
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/$/);

    const token = await getAuthToken(request);

    // Create test data via API
    const account = await createAccount(request, token, USD_ACCOUNT_NAME, 'USD');
    const category = await createExpenseCategory(request, token, UAH_CATEGORY_NAME, 'UAH');

    try {
      // Navigate to home and wait for data to load
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Wait for account and category circles to be visible
      await expect(page.getByText(USD_ACCOUNT_NAME, { exact: true }).first()).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByText(UAH_CATEGORY_NAME, { exact: true }).first()).toBeVisible({
        timeout: 15_000,
      });

      // Perform drag: USD account → UAH expense category
      const accountCircle = getCircleByName(page, USD_ACCOUNT_NAME);
      const categoryCircle = getCircleByName(page, UAH_CATEGORY_NAME);

      await performDrag(page, accountCircle, categoryCircle);

      // ── Assert: Transaction modal is visible ─────────────────────────────────
      const modal = page.locator('h2', { hasText: 'New Transaction' });
      await expect(modal).toBeVisible({ timeout: 10_000 });

      // ── Assert: Three-field form labels are present ──────────────────────────
      // Label "Amount (USD)" — source amount field
      await expect(page.getByText('Amount (USD)', { exact: true })).toBeVisible({ timeout: 5_000 });
      // Label "Exchange Rate"
      await expect(page.getByText('Exchange Rate', { exact: true })).toBeVisible({ timeout: 5_000 });
      // Label "Total (UAH)"
      await expect(page.getByText('Total (UAH)', { exact: true })).toBeVisible({ timeout: 5_000 });

      // ── Assert: Exchange rate field is pre-filled (non-zero) ─────────────────
      // The exchange rate input has placeholder "0.0000" and sits after the "Exchange Rate" label
      const exchangeRateInput = page.locator('label').filter({ hasText: 'Exchange Rate' }).locator('..').locator('input[type="number"]');
      await expect(exchangeRateInput).toBeVisible({ timeout: 5_000 });

      // Wait for the live rate to be fetched and filled in
      await expect(exchangeRateInput).not.toHaveValue('', { timeout: 10_000 });
      const rateValue = await exchangeRateInput.inputValue();
      expect(parseFloat(rateValue)).toBeGreaterThan(0);

      // ── Enter source amount ───────────────────────────────────────────────────
      const sourceInput = page.locator('label').filter({ hasText: 'Amount (USD)' }).locator('..').locator('input[type="number"]');
      await expect(sourceInput).toBeVisible();
      await sourceInput.fill('10');

      // ── Assert: Target amount auto-calculates ────────────────────────────────
      const targetInput = page.locator('label').filter({ hasText: 'Total (UAH)' }).locator('..').locator('input[type="number"]');
      await expect(targetInput).toBeVisible();

      // Wait for reactive calculation to populate the target field
      await expect(targetInput).not.toHaveValue('', { timeout: 5_000 });
      await expect(targetInput).not.toHaveValue('0', { timeout: 5_000 });
      const targetValue = await targetInput.inputValue();
      expect(parseFloat(targetValue)).toBeGreaterThan(0);

      // ── Get account balance before confirming ────────────────────────────────
      // We read balance from the API to avoid the complexity of scraping the modal
      const accountDataBefore = await gql<{
        accounts: Array<{ id: string; currentBalance: number }>;
      }>(request, '{ accounts { id currentBalance } }', undefined, token);
      const balanceBefore =
        accountDataBefore.accounts.find((a) => a.id === account.id)?.currentBalance ?? 0;

      // ── Click Confirm ─────────────────────────────────────────────────────────
      const confirmBtn = page.getByRole('button', { name: 'Confirm' });
      await expect(confirmBtn).toBeEnabled({ timeout: 5_000 });
      await confirmBtn.click();

      // ── Assert: Modal closes (transaction created successfully) ───────────────
      await expect(modal).not.toBeVisible({ timeout: 10_000 });

      // ── Assert: Account balance decreased by source amount (10 USD) ──────────
      const accountDataAfter = await gql<{
        accounts: Array<{ id: string; currentBalance: number }>;
      }>(request, '{ accounts { id currentBalance } }', undefined, token);
      const balanceAfter =
        accountDataAfter.accounts.find((a) => a.id === account.id)?.currentBalance ?? 0;

      expect(balanceAfter).toBeCloseTo(balanceBefore - 10, 1);
    } finally {
      // Cleanup regardless of test outcome
      await deleteExpenseCategory(request, token, category.id);
      await deleteAccount(request, token, account.id);
    }
  });

  test('same-currency: drag USD account onto USD category shows only a single amount field', async ({
    page,
    request,
  }) => {
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/$/);

    const token = await getAuthToken(request);

    // Create test data via API
    const account = await createAccount(request, token, `${USD_ACCOUNT_NAME}-2`, 'USD');
    const category = await createExpenseCategory(request, token, USD_CATEGORY_NAME, 'USD');

    try {
      // Navigate to home and wait for data to load
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Wait for account and category circles to be visible
      await expect(page.getByText(account.name, { exact: true }).first()).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByText(USD_CATEGORY_NAME, { exact: true }).first()).toBeVisible({
        timeout: 15_000,
      });

      // Perform drag: USD account → USD expense category
      const accountCircle = getCircleByName(page, account.name);
      const categoryCircle = getCircleByName(page, USD_CATEGORY_NAME);

      await performDrag(page, accountCircle, categoryCircle);

      // ── Assert: Transaction modal is visible ─────────────────────────────────
      const modal = page.locator('h2', { hasText: 'New Transaction' });
      await expect(modal).toBeVisible({ timeout: 10_000 });

      // ── Assert: Only a single "Amount" label (no currency suffix) ───────────
      // The single-currency form renders label text "Amount" (no currency code appended)
      await expect(page.getByText('Amount', { exact: true })).toBeVisible({ timeout: 5_000 });

      // ── Assert: No "Exchange Rate" field present ─────────────────────────────
      await expect(page.getByText('Exchange Rate', { exact: true })).not.toBeVisible();

      // ── Assert: No "Total (UAH)" or any "Total (" label present ────────────
      await expect(page.locator('label', { hasText: /^Total \(/ })).not.toBeVisible();

      // ── Assert: No "Amount (USD)" label (i.e. no currency suffix on label) ──
      await expect(page.getByText('Amount (USD)', { exact: true })).not.toBeVisible();

      // ── Close the modal (cancel flow) ─────────────────────────────────────────
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(modal).not.toBeVisible({ timeout: 5_000 });
    } finally {
      // Cleanup regardless of test outcome
      await deleteExpenseCategory(request, token, category.id);
      await deleteAccount(request, token, account.id);
    }
  });
});
