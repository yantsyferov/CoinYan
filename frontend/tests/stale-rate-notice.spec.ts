/**
 * Slice 10 acceptance test — Stale Rate UI Notice
 *
 * Verifies that when the BFF returns `stale: true` for an exchange rate
 * query, the TransactionModal renders the "⚠ Rate may be outdated" amber
 * notice next to the Exchange Rate field.
 *
 * Strategy:
 * - Create a USD account and a UAH expense category via GraphQL API so the
 *   home page renders them as draggable/droppable CircleItems.
 * - Intercept the BFF GraphQL POST at /graphql and, for any request whose
 *   body contains the `ExchangeRate` operation name, respond with a mock
 *   that includes `stale: true`.  This avoids having to actually disable
 *   external APIs and makes the test deterministic.
 * - Drag the USD account circle onto the UAH category circle to trigger the
 *   TransactionModal (cross-currency expense flow).
 * - Assert that "Rate may be outdated" is visible in the modal.
 * - Cancel and clean up created test data.
 */

import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './auth.setup';
import { gql, getAuthToken, performDrag, getCircleByName } from './helpers';

test.setTimeout(60_000);

const TS = Date.now();
const USD_ACCOUNT_NAME = `SR10-USD-${TS}`;
const UAH_CATEGORY_NAME = `SR10-UAH-${TS}`;
const TODAY = new Date().toISOString().slice(0, 10);
const MOCK_STALE_RATE = 41.5;

// ── API helpers ────────────────────────────────────────────────────────────────

async function createUSDAccount(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  name: string,
): Promise<{ id: string }> {
  const data = await gql<{ createAccount: { id: string } }>(
    request,
    `mutation CreateAccount($input: CreateAccountInput!) {
       createAccount(input: $input) { id }
     }`,
    { input: { name, icon: 'cash', currency: 'USD', startingBalance: 500 } },
    token,
  );
  return data.createAccount;
}

async function createUAHCategory(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  name: string,
): Promise<{ id: string }> {
  const data = await gql<{ createExpenseCategory: { id: string } }>(
    request,
    `mutation CreateExpenseCategory($input: CreateCategoryInput!) {
       createExpenseCategory(input: $input) { id }
     }`,
    { input: { name, icon: 'cash', currency: 'UAH' } },
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

// ── Test ───────────────────────────────────────────────────────────────────────

test('stale rate notice is shown in TransactionModal when stale: true is returned', async ({
  page,
  request,
}) => {
  // ── Step 1: Authenticate and create test data ────────────────────────────
  await loginAsTestUser(page);
  await expect(page).toHaveURL(/\/$/);

  const token = await getAuthToken(request);
  const account = await createUSDAccount(request, token, USD_ACCOUNT_NAME);
  const category = await createUAHCategory(request, token, UAH_CATEGORY_NAME);

  try {
    // ── Step 2: Navigate to home page and wait for circles to render ──────
    // Load the page first (without any interception) so the accounts and
    // categories data is fetched normally and the circles appear on screen.
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for the test account and category circles to appear
    await expect(page.getByText(USD_ACCOUNT_NAME, { exact: true }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(UAH_CATEGORY_NAME, { exact: true }).first()).toBeVisible({
      timeout: 20_000,
    });

    // ── Step 3: Install the BFF GraphQL intercept AFTER page data is loaded ──
    // Any POST to /graphql whose body includes the "ExchangeRate" operation
    // is replied with a mock response that has stale: true.  All other
    // GraphQL operations (accounts, categories, mutations) pass through.
    // Installing the intercept after initial load avoids blocking the queries
    // that render the account/category circles.
    await page.route('**/graphql', async (route) => {
      const requestBody = route.request().postDataJSON() as { operationName?: string } | null;
      if (requestBody?.operationName === 'ExchangeRate') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              exchangeRate: {
                from: 'USD',
                to: 'UAH',
                date: TODAY,
                rate: MOCK_STALE_RATE,
                stale: true,
              },
            },
          }),
        });
      } else {
        // Let all other GraphQL requests through normally
        await route.continue();
      }
    });

    // ── Step 4: Drag USD account onto UAH category to open expense modal ──
    const accountCircle = getCircleByName(page, USD_ACCOUNT_NAME);
    const categoryCircle = getCircleByName(page, UAH_CATEGORY_NAME);

    // Scroll both elements into the viewport before dragging.  The home page
    // may have many accumulated circles from prior test runs — the new circles
    // could be below the visible fold, causing the pointer-based drag to fail
    // silently because mouse.move() coordinates outside the viewport are ignored.
    await accountCircle.scrollIntoViewIfNeeded();
    await categoryCircle.scrollIntoViewIfNeeded();

    // Brief pause for the browser to settle after scroll
    await page.waitForTimeout(300);

    await performDrag(page, accountCircle, categoryCircle);

    // ── Step 5: Wait for the TransactionModal to appear ───────────────────
    const modalTitle = page.locator('h2', { hasText: 'New Transaction' });
    await expect(modalTitle).toBeVisible({ timeout: 10_000 });

    // The modal must show the cross-currency form (three fields) because
    // USD account → UAH category is a cross-currency pair.
    const exchangeRateLabel = page.locator('label', { hasText: 'Exchange Rate' });
    await expect(exchangeRateLabel).toBeVisible({ timeout: 10_000 });

    // Wait for the exchangeRate query to complete and the hook to propagate
    // stale=true into the component state.  The mock responds immediately, so
    // a short poll is sufficient.
    await expect(page.getByText('Rate may be outdated')).toBeVisible({ timeout: 10_000 });

    // ── Step 6: Confirm the notice is amber (color #D97706) ───────────────
    // We do not assert inline CSS colour in Playwright because inline colour
    // assertions are brittle.  Presence of the text node is the acceptance criterion.
    const staleNotice = page.getByText('Rate may be outdated');
    await expect(staleNotice).toBeVisible();

    // ── Step 7: The Exchange Rate field is pre-filled with the mock rate ──
    // When stale=true and rateIsCustom=false, the hook still sets the rate.
    // The useEffect in TransactionModal pre-fills exchangeRate from suggestedRate.
    const rateInput = page
      .locator('label')
      .filter({ hasText: 'Exchange Rate' })
      .locator('..')   // label row div
      .locator('..')   // field wrapper div
      .locator('input[type="number"]');
    await expect(rateInput).toBeVisible({ timeout: 5_000 });
    const rateValue = await rateInput.inputValue();
    expect(parseFloat(rateValue)).toBeCloseTo(MOCK_STALE_RATE, 2);

    // ── Step 8: Close the modal ────────────────────────────────────────────
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(modalTitle).not.toBeVisible({ timeout: 10_000 });
  } finally {
    // ── Teardown: clean up test data regardless of test outcome ───────────
    await deleteExpenseCategory(request, token, category.id);
    await deleteAccount(request, token, account.id);
  }
});
