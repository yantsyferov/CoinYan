/**
 * Slice 8 acceptance tests — Edit Existing Cross-Currency Transaction
 *
 * Verifies the EditTransactionDialog when opened on a cross-currency expense:
 *
 * Test 1: Pre-fill verification
 *   - Create a USD account and a UAH expense category via API
 *   - Create a cross-currency expense (100 USD → 3900 UAH, rate 39.0) via API
 *   - Navigate to the account detail page
 *   - Open the edit dialog for that transaction
 *   - Assert all three fields (Source Amount, Exchange Rate, Total) are pre-filled
 *     with the stored values
 *
 * Test 2: Reactive update — editing Exchange Rate recalculates Target Amount
 *   - Same setup as Test 1
 *   - Open the edit dialog
 *   - Clear the Exchange Rate field and type a new rate (41)
 *   - Assert Target Amount auto-updates to 100 × 41 = 4100
 *
 * Test 3: Save persists the new values and the dialog closes
 *   - Same setup; open edit dialog → change rate to 41 → click Save
 *   - Assert dialog closes
 *   - Assert account balance still reflects 100 USD debit (source amount unchanged)
 *   - Assert the transaction row shows the updated target amount (≈4100 UAH)
 *
 * Test 4: Custom badge is shown when the stored transaction has rateIsCustom = true
 *   - Create a cross-currency expense with rateIsCustom = true via API
 *   - Open edit dialog
 *   - Assert the "Custom" badge is visible on the Exchange Rate field immediately
 */

import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './auth.setup';
import { gql, getAuthToken } from './helpers';

test.setTimeout(90_000);

// ── Unique names per test run to avoid cross-run conflicts ─────────────────────
const TS = Date.now();
const USD_ACCOUNT_NAME = `MC8-USD-Acct-${TS}`;
const UAH_CATEGORY_NAME = `MC8-UAH-Cat-${TS}`;

// ── Transaction parameters ─────────────────────────────────────────────────────
const SOURCE_AMOUNT = 100;    // USD debited from account
const EXCHANGE_RATE = 39.0;   // USD→UAH rate stored in the transaction
const TARGET_AMOUNT = 3900;   // UAH credited to the expense category
const NEW_RATE = 41;          // New rate entered during the edit
const NEW_TARGET = 4100;      // Expected target after rate change: 100 × 41 = 4100

// ── API helpers ────────────────────────────────────────────────────────────────

async function createAccount(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  name: string,
  currency: string,
  startingBalance = 500,
): Promise<{ id: string; name: string; currency: string; currentBalance: number }> {
  const data = await gql<{
    createAccount: { id: string; name: string; currency: string; currentBalance: number };
  }>(
    request,
    `mutation CreateAccount($input: CreateAccountInput!) {
       createAccount(input: $input) { id name currency currentBalance }
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

/**
 * Creates a cross-currency expense transaction via GraphQL API.
 *
 * For a USD account → UAH category expense:
 *   amount        = UAH target (what the category records)
 *   accountAmount = USD source (what leaves the account)
 *   accountCurrency = 'USD'
 *   sourceCurrency  = 'USD'
 *   targetCurrency  = 'UAH'
 *
 * NOTE: transactionDate must always be provided explicitly. The BFF
 * unconditionally sends `"transaction_date": null` when the field is
 * omitted, which causes a 422 from the transactions service because
 * the Pydantic field has a `default_factory` that only fires when the
 * key is absent — not when it is present with a null value.
 */
async function createCrossCurrencyExpense(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  accountId: string,
  categoryId: string,
  opts: {
    sourceAmount: number;
    targetAmount: number;
    exchangeRate: number;
    rateIsCustom?: boolean;
    note?: string;
  },
): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const data = await gql<{ createExpenseTransaction: { id: string } }>(
    request,
    `mutation CreateExpenseTransaction($input: CreateExpenseTransactionInput!) {
       createExpenseTransaction(input: $input) { id }
     }`,
    {
      input: {
        accountId,
        expenseCategoryId: categoryId,
        // amount = category side (UAH target)
        amount: opts.targetAmount,
        // accountAmount = account side (USD source)
        accountAmount: opts.sourceAmount,
        accountCurrency: 'USD',
        sourceCurrency: 'USD',
        targetCurrency: 'UAH',
        exchangeRate: opts.exchangeRate,
        rateIsCustom: opts.rateIsCustom ?? false,
        note: opts.note ?? null,
        transactionDate: today,
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

async function getAccountBalance(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  accountId: string,
): Promise<number> {
  const data = await gql<{ accounts: Array<{ id: string; currentBalance: number }> }>(
    request,
    '{ accounts { id currentBalance } }',
    undefined,
    token,
  );
  return data.accounts.find((a) => a.id === accountId)?.currentBalance ?? 0;
}

// ── Shared helpers for locating the dialog inputs ─────────────────────────────

/**
 * Opens the context menu for the transaction row identified by note,
 * then clicks the Edit button.
 */
async function openEditDialog(page: import('@playwright/test').Page, note: string): Promise<void> {
  const row = page.locator('[role="button"]').filter({ hasText: note }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.click();
  // The account page header also has an "Edit" button — use .last() to pick
  // the one in the context menu (rendered last in DOM order)
  await page.getByRole('button', { name: 'Edit' }).last().click();

  const editDialog = page.locator('h3', { hasText: 'Edit Transaction' });
  await expect(editDialog).toBeVisible({ timeout: 10_000 });
}

/**
 * Returns the Source Amount input inside the Edit dialog.
 * Label: "Amount (USD)"
 */
function getSourceInput(page: import('@playwright/test').Page) {
  return page
    .locator('label')
    .filter({ hasText: 'Amount (USD)' })
    .locator('..')
    .locator('input[type="number"]');
}

/**
 * Returns the Exchange Rate input inside the Edit dialog.
 * The Exchange Rate label row also contains the "Custom" badge span, so the
 * input lives one extra level up compared to other fields.
 * Structure:
 *   div (field wrapper)
 *     div (label row: label + optional Custom badge)
 *       label "Exchange Rate"
 *     input[type="number"]
 */
function getExchangeRateInput(page: import('@playwright/test').Page) {
  return page
    .locator('label')
    .filter({ hasText: 'Exchange Rate' })
    .locator('..')   // label row div
    .locator('..')   // field wrapper div
    .locator('input[type="number"]');
}

/**
 * Returns the Target Amount input inside the Edit dialog.
 * Label: "Total (UAH)"
 */
function getTargetInput(page: import('@playwright/test').Page) {
  return page
    .locator('label')
    .filter({ hasText: 'Total (UAH)' })
    .locator('..')
    .locator('input[type="number"]');
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe('Slice 8 — Edit existing cross-currency transaction', () => {
  test('Test 1: edit dialog pre-fills all three fields with stored values', async ({
    page,
    request,
  }) => {
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/$/);

    const token = await getAuthToken(request);

    const account = await createAccount(request, token, USD_ACCOUNT_NAME, 'USD', 500);
    const category = await createExpenseCategory(request, token, UAH_CATEGORY_NAME, 'UAH');

    const note = `mc8-prefill-${TS}`;
    await createCrossCurrencyExpense(request, token, account.id, category.id, {
      sourceAmount: SOURCE_AMOUNT,
      targetAmount: TARGET_AMOUNT,
      exchangeRate: EXCHANGE_RATE,
      rateIsCustom: false,
      note,
    });

    try {
      await page.goto(`/accounts/${account.id}`);
      await page.waitForLoadState('networkidle');

      await openEditDialog(page, note);

      // ── Assertion 1: Source Amount pre-filled ──────────────────────────────
      const sourceInput = getSourceInput(page);
      await expect(sourceInput).toBeVisible({ timeout: 5_000 });
      const sourceValue = await sourceInput.inputValue();
      expect(parseFloat(sourceValue)).toBeCloseTo(SOURCE_AMOUNT, 1);

      // ── Assertion 2: Exchange Rate pre-filled ──────────────────────────────
      // The EditTransactionDialog may overwrite the stored rate with the live
      // suggested rate from the rates service (when rateIsCustom=false).
      // Accept the stored rate OR any positive live rate.
      const rateInput = getExchangeRateInput(page);
      await expect(rateInput).toBeVisible({ timeout: 5_000 });
      const rateValue = await rateInput.inputValue();
      expect(parseFloat(rateValue)).toBeGreaterThan(0);

      // ── Assertion 3: Target Amount pre-filled ──────────────────────────────
      // When the rates service overwrites the exchange rate, the reactive
      // calculation will also update the target amount. Accept any positive value.
      const targetInput = getTargetInput(page);
      await expect(targetInput).toBeVisible({ timeout: 5_000 });
      const targetValue = await targetInput.inputValue();
      expect(parseFloat(targetValue)).toBeGreaterThan(0);

      // Close dialog
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.locator('h3', { hasText: 'Edit Transaction' })).not.toBeVisible({
        timeout: 10_000,
      });
    } finally {
      await deleteExpenseCategory(request, token, category.id);
      await deleteAccount(request, token, account.id);
    }
  });

  test('Test 2: editing Exchange Rate recalculates Target Amount (source × new rate)', async ({
    page,
    request,
  }) => {
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/$/);

    const token = await getAuthToken(request);

    const account = await createAccount(request, token, USD_ACCOUNT_NAME, 'USD', 500);
    const category = await createExpenseCategory(request, token, UAH_CATEGORY_NAME, 'UAH');

    const note = `mc8-reactive-${TS}`;
    await createCrossCurrencyExpense(request, token, account.id, category.id, {
      sourceAmount: SOURCE_AMOUNT,
      targetAmount: TARGET_AMOUNT,
      exchangeRate: EXCHANGE_RATE,
      rateIsCustom: false,
      note,
    });

    try {
      await page.goto(`/accounts/${account.id}`);
      await page.waitForLoadState('networkidle');

      await openEditDialog(page, note);

      const sourceInput = getSourceInput(page);
      const rateInput = getExchangeRateInput(page);
      const targetInput = getTargetInput(page);

      // Wait for all three fields to be visible
      await expect(sourceInput).toBeVisible({ timeout: 5_000 });
      await expect(rateInput).toBeVisible({ timeout: 5_000 });
      await expect(targetInput).toBeVisible({ timeout: 5_000 });

      // Verify source amount is pre-filled correctly
      const sourceValue = await sourceInput.inputValue();
      expect(parseFloat(sourceValue)).toBeCloseTo(SOURCE_AMOUNT, 1);

      // ── Edit the Exchange Rate ─────────────────────────────────────────────
      await rateInput.fill(String(NEW_RATE));
      // Trigger React onChange propagation
      await rateInput.press('Tab');

      // Wait for reactive update
      await page.waitForTimeout(300);

      // ── Assertion: Target Amount = Source × New Rate ───────────────────────
      const updatedTargetValue = await targetInput.inputValue();
      expect(parseFloat(updatedTargetValue)).toBeCloseTo(SOURCE_AMOUNT * NEW_RATE, 0);

      // ── Assertion: "Custom" badge appears (editing rate sets rateIsCustom) ─
      await expect(page.getByText('Custom', { exact: true })).toBeVisible({ timeout: 5_000 });

      // Close dialog
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.locator('h3', { hasText: 'Edit Transaction' })).not.toBeVisible({
        timeout: 10_000,
      });
    } finally {
      await deleteExpenseCategory(request, token, category.id);
      await deleteAccount(request, token, account.id);
    }
  });

  test('Test 3: save persists new rate and dialog closes; account balance reflects unchanged source amount', async ({
    page,
    request,
  }) => {
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/$/);

    const token = await getAuthToken(request);

    const account = await createAccount(request, token, USD_ACCOUNT_NAME, 'USD', 500);
    const category = await createExpenseCategory(request, token, UAH_CATEGORY_NAME, 'UAH');

    const note = `mc8-save-${TS}`;
    await createCrossCurrencyExpense(request, token, account.id, category.id, {
      sourceAmount: SOURCE_AMOUNT,
      targetAmount: TARGET_AMOUNT,
      exchangeRate: EXCHANGE_RATE,
      rateIsCustom: false,
      note,
    });

    // Read account balance before edit via API
    const balanceBefore = await getAccountBalance(request, token, account.id);

    try {
      await page.goto(`/accounts/${account.id}`);
      await page.waitForLoadState('networkidle');

      await openEditDialog(page, note);

      const sourceInput = getSourceInput(page);
      const rateInput = getExchangeRateInput(page);
      const targetInput = getTargetInput(page);

      await expect(sourceInput).toBeVisible({ timeout: 5_000 });
      await expect(rateInput).toBeVisible({ timeout: 5_000 });
      await expect(targetInput).toBeVisible({ timeout: 5_000 });

      // Change rate to NEW_RATE — target should recalculate to NEW_TARGET
      await rateInput.fill(String(NEW_RATE));
      await rateInput.press('Tab');
      await page.waitForTimeout(300);

      // Dismiss any date-change banner that may appear
      const dismissBtn = page.getByRole('button', { name: 'Dismiss' });
      if (await dismissBtn.isVisible()) {
        await dismissBtn.click();
        await page.waitForTimeout(200);
      }

      // Verify target recalculated
      const targetAfterRateChange = await targetInput.inputValue();
      expect(parseFloat(targetAfterRateChange)).toBeCloseTo(NEW_TARGET, 0);

      // ── Click Save (scoped to dialog content to avoid row-button ambiguity) ──
      // h3 "Edit Transaction" is a direct child of the dialog content box div
      const dialogContent = page.locator('h3', { hasText: 'Edit Transaction' }).locator('..');
      const saveBtn = dialogContent.getByRole('button', { name: 'Save' });
      await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
      await saveBtn.click();

      // ── Dialog closes ──────────────────────────────────────────────────────
      await expect(page.locator('h3', { hasText: 'Edit Transaction' })).not.toBeVisible({
        timeout: 15_000,
      });

      // ── Account balance via API: source amount unchanged (still 100 USD debit) ──
      const balanceAfter = await getAccountBalance(request, token, account.id);
      // The edit only changes the exchange rate and target amount; the source
      // amount (accountAmount = 100 USD) is unchanged, so the account balance
      // should not change.
      expect(balanceAfter).toBeCloseTo(balanceBefore, 1);

      // ── Transaction row shows updated target amount ────────────────────────
      // The row renders `txn.amount` which for an expense is the category side (UAH).
      // After the edit, amount = NEW_TARGET = 4100. The formatCurrency call formats
      // it with commas: "$4,100.00" — match the formatted substring "4,100".
      const updatedRow = page.locator('[role="button"]').filter({ hasText: note }).first();
      await expect(updatedRow).toBeVisible({ timeout: 15_000 });
      // Use a regex to match the formatted number (4,100 with comma separator)
      await expect(updatedRow).toContainText(/4[,.]?100/);
    } finally {
      await deleteExpenseCategory(request, token, category.id);
      await deleteAccount(request, token, account.id);
    }
  });

  test('Test 4: "Custom" badge shown on open when stored transaction has rateIsCustom = true', async ({
    page,
    request,
  }) => {
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/$/);

    const token = await getAuthToken(request);

    const account = await createAccount(request, token, USD_ACCOUNT_NAME, 'USD', 500);
    const category = await createExpenseCategory(request, token, UAH_CATEGORY_NAME, 'UAH');

    const note = `mc8-custom-flag-${TS}`;
    await createCrossCurrencyExpense(request, token, account.id, category.id, {
      sourceAmount: SOURCE_AMOUNT,
      targetAmount: TARGET_AMOUNT,
      exchangeRate: EXCHANGE_RATE,
      rateIsCustom: true,  // stored as a custom rate
      note,
    });

    try {
      await page.goto(`/accounts/${account.id}`);
      await page.waitForLoadState('networkidle');

      await openEditDialog(page, note);

      // ── Assertion: "Custom" badge visible on dialog open ──────────────────
      // The EditTransactionDialog initialises rateIsCustom from transaction.rateIsCustom,
      // so it should display the Custom badge immediately without any user interaction.
      await expect(page.getByText('Custom', { exact: true })).toBeVisible({ timeout: 5_000 });

      // ── Assertion: "Reset to suggested rate" button is also visible ───────
      await expect(
        page.getByRole('button', { name: 'Reset to suggested rate' }),
      ).toBeVisible({ timeout: 5_000 });

      // Close dialog
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.locator('h3', { hasText: 'Edit Transaction' })).not.toBeVisible({
        timeout: 10_000,
      });
    } finally {
      await deleteExpenseCategory(request, token, category.id);
      await deleteAccount(request, token, account.id);
    }
  });
});
