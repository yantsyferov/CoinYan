import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './auth.setup';
import { gql, getAuthToken } from './helpers';

// Unique suffixes so parallel runs or re-runs don't clash
const TS = Date.now();
const EXPENSE_CAT_NAME = `PW-UAH-Cat-${TS}`;
const INCOME_SRC_NAME = `PW-EUR-Src-${TS}`;

// ─── helpers ──────────────────────────────────────────────────────────────────

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

async function deleteIncomeSource(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  id: string,
): Promise<void> {
  await gql(
    request,
    `mutation DeleteIncomeSource($id: ID!) { deleteIncomeSource(id: $id) }`,
    { id },
    token,
  );
}

// ─── tests ────────────────────────────────────────────────────────────────────

test.describe('Category currency picker — Slice 2 acceptance', () => {
  test('create expense category with UAH and verify it appears with UAH currency', async ({ page, request }) => {
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/$/);

    const token = await getAuthToken(request);

    // Navigate to categories page
    await page.goto('/categories');
    await page.waitForLoadState('networkidle');

    // Open "Add Expense Category" modal via the + button under "Expense Categories"
    const expenseSection = page.locator('section').filter({ hasText: 'Expense Categories' });
    await expect(expenseSection).toBeVisible({ timeout: 10_000 });
    await expenseSection.locator('button', { hasText: '+' }).click();

    // Modal should appear
    const modal = page.locator('div').filter({ hasText: 'Add Expense Category' }).last();
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Fill name
    await page.getByPlaceholder('e.g. Groceries').fill(EXPENSE_CAT_NAME);

    // Select UAH from the currency picker (it's a <select> element)
    const currencySelect = modal.locator('select');
    await currencySelect.selectOption('UAH');
    await expect(currencySelect).toHaveValue('UAH');

    // Submit
    await modal.locator('button', { hasText: 'Save' }).click();

    // Modal should close
    await expect(page.locator('h2', { hasText: 'Add Expense Category' })).not.toBeVisible({ timeout: 10_000 });

    // The new category should appear by name in the Expense Categories section
    await expect(expenseSection.locator('span', { hasText: EXPENSE_CAT_NAME })).toBeVisible({ timeout: 10_000 });

    // Verify the currency via GraphQL API
    const data = await gql<{ expenseCategories: Array<{ id: string; name: string; currency: string }> }>(
      request,
      '{ expenseCategories { id name currency } }',
      undefined,
      token,
    );

    const created = data.expenseCategories.find((c) => c.name === EXPENSE_CAT_NAME);
    expect(created, `Category "${EXPENSE_CAT_NAME}" not found in API response`).toBeTruthy();
    expect(created!.currency).toBe('UAH');

    // Cleanup
    await deleteExpenseCategory(request, token, created!.id);
  });

  test('create income source with EUR and verify it appears with EUR currency', async ({ page, request }) => {
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/$/);

    const token = await getAuthToken(request);

    // Navigate to categories page
    await page.goto('/categories');
    await page.waitForLoadState('networkidle');

    // Open "Add Income Source" modal via the + button under "Income Sources"
    const incomeSection = page.locator('section').filter({ hasText: 'Income Sources' });
    await expect(incomeSection).toBeVisible({ timeout: 10_000 });
    await incomeSection.locator('button', { hasText: '+' }).click();

    // Modal should appear
    const modal = page.locator('div').filter({ hasText: 'Add Income Source' }).last();
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Fill name
    await page.getByPlaceholder('e.g. Groceries').fill(INCOME_SRC_NAME);

    // Select EUR from the currency picker
    const currencySelect = modal.locator('select');
    await currencySelect.selectOption('EUR');
    await expect(currencySelect).toHaveValue('EUR');

    // Submit
    await modal.locator('button', { hasText: 'Save' }).click();

    // Modal should close
    await expect(page.locator('h2', { hasText: 'Add Income Source' })).not.toBeVisible({ timeout: 10_000 });

    // The new income source should appear by name in the Income Sources section
    await expect(incomeSection.locator('span', { hasText: INCOME_SRC_NAME })).toBeVisible({ timeout: 10_000 });

    // Verify the currency via GraphQL API
    const data = await gql<{ incomeSources: Array<{ id: string; name: string; currency: string }> }>(
      request,
      '{ incomeSources { id name currency } }',
      undefined,
      token,
    );

    const created = data.incomeSources.find((s) => s.name === INCOME_SRC_NAME);
    expect(created, `Income source "${INCOME_SRC_NAME}" not found in API response`).toBeTruthy();
    expect(created!.currency).toBe('EUR');

    // Cleanup
    await deleteIncomeSource(request, token, created!.id);
  });

  test('pre-existing categories retain USD currency and remain functional', async ({ page, request }) => {
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/$/);

    const token = await getAuthToken(request);

    // Ensure at least one expense category exists (with default USD)
    const existingData = await gql<{
      expenseCategories: Array<{ id: string; name: string; currency: string }>;
      incomeSources: Array<{ id: string; name: string; currency: string }>;
    }>(
      request,
      '{ expenseCategories { id name currency } incomeSources { id name currency } }',
      undefined,
      token,
    );

    // If no pre-existing categories exist, create one via API with default currency (USD)
    let expenseCatToCheck: { id: string; name: string; currency: string };
    let createdViaApi = false;

    if (existingData.expenseCategories.length === 0) {
      const created = await gql<{ createExpenseCategory: { id: string; name: string; currency: string } }>(
        request,
        `mutation CreateExpenseCategory($input: CreateCategoryInput!) {
           createExpenseCategory(input: $input) { id name currency }
         }`,
        { input: { name: `PW-USD-Default-${TS}`, icon: 'cash' } },
        token,
      );
      expenseCatToCheck = created.createExpenseCategory;
      createdViaApi = true;
    } else {
      // Pick first category that has USD (or any — it should default to USD)
      expenseCatToCheck = existingData.expenseCategories[0];
    }

    // Verify currency is USD
    expect(expenseCatToCheck.currency).toBe('USD');

    // Navigate to categories page and confirm the category appears in the list
    await page.goto('/categories');
    await page.waitForLoadState('networkidle');

    const expenseSection = page.locator('section').filter({ hasText: 'Expense Categories' });
    await expect(expenseSection).toBeVisible({ timeout: 10_000 });
    await expect(
      expenseSection.locator('span', { hasText: expenseCatToCheck.name }),
    ).toBeVisible({ timeout: 10_000 });

    // Also verify at least one income source with USD exists (or the query returns currency field)
    let incomeSourceToCheck: { id: string; name: string; currency: string } | undefined;
    let createdIncomeViaApi = false;

    if (existingData.incomeSources.length === 0) {
      const created = await gql<{ createIncomeSource: { id: string; name: string; currency: string } }>(
        request,
        `mutation CreateIncomeSource($input: CreateCategoryInput!) {
           createIncomeSource(input: $input) { id name currency }
         }`,
        { input: { name: `PW-USD-IncSrc-${TS}`, icon: 'cash' } },
        token,
      );
      incomeSourceToCheck = created.createIncomeSource;
      createdIncomeViaApi = true;
    } else {
      incomeSourceToCheck = existingData.incomeSources[0];
    }

    expect(incomeSourceToCheck!.currency).toBe('USD');

    const incomeSection = page.locator('section').filter({ hasText: 'Income Sources' });
    await expect(incomeSection).toBeVisible({ timeout: 10_000 });
    await expect(
      incomeSection.locator('span', { hasText: incomeSourceToCheck!.name }),
    ).toBeVisible({ timeout: 10_000 });

    // Cleanup any API-created items
    if (createdViaApi) {
      await deleteExpenseCategory(request, token, expenseCatToCheck.id);
    }
    if (createdIncomeViaApi && incomeSourceToCheck) {
      await deleteIncomeSource(request, token, incomeSourceToCheck.id);
    }
  });
});
