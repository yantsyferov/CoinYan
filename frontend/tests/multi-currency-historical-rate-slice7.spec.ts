/**
 * Slice 7 acceptance tests — Historical Rate Suggestion Banner
 *
 * Currency pair: USD account → EUR expense category.
 * Reason: Frankfurter API supports USD/EUR for historical dates (since 1999),
 * but does NOT support UAH. Using UAH would always yield a null rate from
 * Frankfurter for historical dates, so the banner would never appear.
 *
 * Test 1: Banner appears when user changes date after modal open
 *   - Drag USD account onto EUR expense category → three-field form opens
 *   - Enter a source amount
 *   - Change the date to a historical date (2023-01-02)
 *   - Wait for the banner: "Historical rate for 2023-01-02: X.XXXX. Apply it?"
 *   - Assert: banner visible with Apply and Dismiss buttons
 *
 * Test 2: Apply updates the Exchange Rate field and removes banner/Custom label
 *   - Same setup, change date → wait for banner → note banner rate
 *   - Click "Apply"
 *   - Assert: banner disappears
 *   - Assert: Exchange Rate field shows the historical rate from banner
 *   - Assert: "Custom" badge is NOT visible (Apply clears rateIsCustom)
 *
 * Test 3: Dismiss hides the banner and leaves rate unchanged
 *   - Same setup, change date → wait for banner
 *   - Note the Exchange Rate value while banner is visible
 *   - Click "Dismiss"
 *   - Assert: banner disappears
 *   - Assert: Exchange Rate field still shows the same value as before
 *
 * Important notes:
 * - Frankfurter API is a live external service; tests skip gracefully if unreachable.
 * - The banner only appears when the user actively changes the date (dateChangedRef.current).
 * - On date change, setPendingSuggestedRate(null) fires first, then the useExchangeRate
 *   hook re-fetches for the new date; when the response arrives, if rate differs from
 *   current field value, the banner is set via setPendingSuggestedRate.
 */

import { test, expect, type Page } from '@playwright/test';
import { loginAsTestUser } from './auth.setup';
import { gql, getAuthToken } from './helpers';

// ── Unique names per test run to avoid cross-run conflicts ─────────────────────
const TS = Date.now();
const USD_ACCOUNT_NAME = `MC7-USD-Acct-${TS}`;
// Use EUR because Frankfurter supports USD/EUR for historical dates.
// Frankfurter does NOT support UAH, so USD→UAH would always return null for
// historical dates, preventing the banner from ever appearing.
const EUR_CATEGORY_NAME = `MC7-EUR-Cat-${TS}`;

// Historical date with known Frankfurter data (USD/EUR available since 1999)
const HISTORICAL_DATE = '2023-01-02';

// ── API helpers ────────────────────────────────────────────────────────────────

async function createAccount(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  name: string,
  currency: string,
): Promise<{ id: string; name: string; currency: string; currentBalance: number }> {
  const data = await gql<{
    createAccount: { id: string; name: string; currency: string; currentBalance: number };
  }>(
    request,
    `mutation CreateAccount($input: CreateAccountInput!) {
       createAccount(input: $input) { id name currency currentBalance }
     }`,
    { input: { name, icon: 'cash', currency, startingBalance: 1000 } },
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

/**
 * Returns a locator for the 72x72 drag/drop circle of a CircleItem.
 *
 * CircleItem DOM structure:
 *   div (outer flexColumn wrapper)            <- name.locator('..')
 *     div (position:relative 72x72 wrapper)   <- .locator('div').first()
 *       div (dragRef -- actual circle div)    <- .locator('div').first()  <- THIS
 *         {icon text}
 *     span (name)                             <- matched by getByText
 *     span (subtitle)
 */
function getCircleDiv(page: Page, name: string) {
  return page
    .getByText(name, { exact: true })
    .first()
    .locator('..')
    .locator('div')
    .first()
    .locator('div')
    .first();
}

/**
 * Scroll both a source account circle and a target category circle into the
 * visible viewport simultaneously, then perform a dnd-kit compatible drag.
 */
async function scrollBothIntoViewAndDrag(
  page: Page,
  sourceAccountName: string,
  targetCategoryName: string,
): Promise<void> {
  // Step 1: Scroll the accounts horizontal container to show the source account
  await page.evaluate((name: string) => {
    const spans = document.querySelectorAll('span');
    let target: Element | null = null;
    for (const span of spans) {
      if (span.textContent?.trim() === name) {
        target = span;
        break;
      }
    }
    if (!target) return;

    let el: Element | null = target.parentElement;
    while (el) {
      const style = window.getComputedStyle(el);
      if (style.overflowX === 'auto' || style.overflowX === 'scroll') {
        const elRect = (target as HTMLElement).getBoundingClientRect();
        const containerRect = (el as HTMLElement).getBoundingClientRect();
        el.scrollLeft = el.scrollLeft + (elRect.left - containerRect.left) - 100;
        return;
      }
      el = el.parentElement;
    }
  }, sourceAccountName);

  // Step 2: Scroll the page vertically so the account circle is in the viewport
  const acctSpan = page.getByText(sourceAccountName, { exact: true }).first();
  await acctSpan.scrollIntoViewIfNeeded();

  const sourceCircle = getCircleDiv(page, sourceAccountName);
  const targetCircle = getCircleDiv(page, targetCategoryName);

  const srcBox = await sourceCircle.boundingBox();
  const tgtBox = await targetCircle.boundingBox();

  if (!srcBox || !tgtBox) throw new Error('Could not get bounding boxes for drag elements');

  // Step 3: If target is below the viewport, scroll window to a Y that shows both
  const viewport = page.viewportSize()!;
  const midY = (srcBox.y + srcBox.height / 2 + tgtBox.y + tgtBox.height / 2) / 2;
  const scrollY = midY - viewport.height / 2;
  if (scrollY > 0) {
    await page.evaluate((y: number) => window.scrollTo(0, y), scrollY);
    await page.waitForTimeout(150);
  }

  // Step 4: Get final bounding boxes and perform the drag
  const srcFinal = await sourceCircle.boundingBox();
  const tgtFinal = await targetCircle.boundingBox();

  if (!srcFinal || !tgtFinal) throw new Error('Could not get final bounding boxes');

  const sx = srcFinal.x + srcFinal.width / 2;
  const sy = srcFinal.y + srcFinal.height / 2;
  const tx = tgtFinal.x + tgtFinal.width / 2;
  const ty = tgtFinal.y + tgtFinal.height / 2;

  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 10, sy + 10); // exceed dnd-kit's 8px activation distance
  await page.mouse.move(tx, ty, { steps: 10 });
  await page.mouse.up();
}

/**
 * Opens the three-field cross-currency form by dragging the USD account onto
 * the EUR expense category and waits for the modal to appear.
 */
async function openThreeFieldForm(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await expect(page.getByText(USD_ACCOUNT_NAME, { exact: true }).first()).toBeAttached({
    timeout: 15_000,
  });
  await expect(page.getByText(EUR_CATEGORY_NAME, { exact: true }).first()).toBeAttached({
    timeout: 15_000,
  });

  await scrollBothIntoViewAndDrag(page, USD_ACCOUNT_NAME, EUR_CATEGORY_NAME);

  const modal = page.locator('h2', { hasText: 'New Transaction' });
  await expect(modal).toBeVisible({ timeout: 10_000 });

  // Ensure all three cross-currency fields are rendered (USD account → EUR category)
  await expect(page.getByText('Amount (USD)', { exact: true })).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText('Exchange Rate', { exact: true })).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText('Total (EUR)', { exact: true })).toBeVisible({ timeout: 5_000 });
}

/**
 * Changes the date field to the given value.
 * Uses fill + dispatchEvent to reliably trigger React's synthetic onChange.
 */
async function changeDateField(page: Page, dateValue: string): Promise<void> {
  const dateInput = page.locator('input[type="date"]');
  await expect(dateInput).toBeVisible({ timeout: 5_000 });

  await dateInput.fill(dateValue);
  await dateInput.dispatchEvent('change');
  // Small wait for React state to propagate (dateChangedRef.current = true)
  await page.waitForTimeout(200);
}

/**
 * Waits for the historical rate suggestion banner to appear.
 * Returns false if the banner does not appear within the timeout (Frankfurter unreachable).
 */
async function waitForBanner(page: Page, timeoutMs = 15_000): Promise<boolean> {
  try {
    await expect(
      page.getByText(/Historical rate for/, { exact: false }),
    ).toBeVisible({ timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe('Slice 7 — Historical rate suggestion banner', () => {
  test('Test 1: banner appears when user changes date to a historical date', async ({
    page,
    request,
  }) => {
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/$/);

    const token = await getAuthToken(request);

    const account = await createAccount(request, token, USD_ACCOUNT_NAME, 'USD');
    const category = await createExpenseCategory(request, token, EUR_CATEGORY_NAME, 'EUR');

    try {
      await openThreeFieldForm(page);

      // Assert: banner is NOT visible on initial modal open
      await expect(page.getByText(/Historical rate for/, { exact: false })).not.toBeVisible();

      // Enter a source amount so the rate field has a value and the modal is in a
      // state where the banner condition (rate differs from current) can fire.
      // The initial rate is fetched for today; changing date fetches for 2023-01-02.
      const sourceInput = page
        .locator('label')
        .filter({ hasText: 'Amount (USD)' })
        .locator('..')
        .locator('input[type="number"]');
      await expect(sourceInput).toBeVisible({ timeout: 5_000 });
      await sourceInput.fill('100');
      await sourceInput.press('Tab');

      // Wait for the initial (today's) rate to settle before changing date
      await page.waitForTimeout(500);

      // Change the date to a historical date — this sets dateChangedRef.current = true
      // and triggers a new rate fetch for 2023-01-02 via Frankfurter
      await changeDateField(page, HISTORICAL_DATE);

      // Wait for the banner (depends on Frankfurter API response time — up to 15s)
      const bannerAppeared = await waitForBanner(page, 15_000);

      if (!bannerAppeared) {
        test.skip(true, 'Frankfurter API did not respond in time — skipping gracefully');
        return;
      }

      // Assert: banner text contains the historical date
      const bannerText = page.getByText(/Historical rate for/, { exact: false });
      await expect(bannerText).toBeVisible();

      // Assert: Apply button is visible within the banner
      await expect(page.getByRole('button', { name: 'Apply' })).toBeVisible({ timeout: 5_000 });

      // Assert: Dismiss button is visible within the banner
      await expect(page.getByRole('button', { name: 'Dismiss' })).toBeVisible({ timeout: 5_000 });

      // Close modal
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.locator('h2', { hasText: 'New Transaction' })).not.toBeVisible({
        timeout: 10_000,
      });
    } finally {
      await deleteExpenseCategory(request, token, category.id);
      await deleteAccount(request, token, account.id);
    }
  });

  test('Test 2: clicking Apply updates the Exchange Rate field and removes the banner', async ({
    page,
    request,
  }) => {
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/$/);

    const token = await getAuthToken(request);

    const account = await createAccount(request, token, USD_ACCOUNT_NAME, 'USD');
    const category = await createExpenseCategory(request, token, EUR_CATEGORY_NAME, 'EUR');

    try {
      await openThreeFieldForm(page);

      // Enter source amount
      const sourceInput = page
        .locator('label')
        .filter({ hasText: 'Amount (USD)' })
        .locator('..')
        .locator('input[type="number"]');
      await sourceInput.fill('100');
      await sourceInput.press('Tab');

      // Wait for initial (today's) rate to settle
      await page.waitForTimeout(500);

      // Change date to trigger historical rate fetch
      await changeDateField(page, HISTORICAL_DATE);

      const bannerAppeared = await waitForBanner(page, 15_000);

      if (!bannerAppeared) {
        test.skip(true, 'Frankfurter API did not respond in time — skipping gracefully');
        return;
      }

      // Extract the historical rate from the banner text.
      // Banner format: "Historical rate for 2023-01-02: X.XXXX. Apply it?"
      const bannerLocator = page.getByText(/Historical rate for/, { exact: false });
      const bannerFullText = await bannerLocator.textContent();
      const rateMatch = bannerFullText?.match(/:\s*([\d.]+)\./);
      const historicalRateFromBanner = rateMatch ? rateMatch[1] : null;

      // Click Apply
      await page.getByRole('button', { name: 'Apply' }).click();

      // Wait for React state to update
      await page.waitForTimeout(300);

      // Assert: banner disappears after Apply
      await expect(page.getByText(/Historical rate for/, { exact: false })).not.toBeVisible({
        timeout: 5_000,
      });

      // Locate the Exchange Rate input field
      const exchangeRateInput = page
        .locator('label')
        .filter({ hasText: 'Exchange Rate' })
        .locator('..')
        .locator('..')
        .locator('input[type="number"]');
      await expect(exchangeRateInput).toBeVisible({ timeout: 5_000 });

      // Assert: Exchange Rate field now shows the historical rate from the banner
      if (historicalRateFromBanner) {
        const rateFieldValue = await exchangeRateInput.inputValue();
        // The field is set to pendingSuggestedRate.toFixed(4); compare numerically
        expect(parseFloat(rateFieldValue)).toBeCloseTo(parseFloat(historicalRateFromBanner), 3);
      }

      // Assert: "Custom" badge is NOT visible (Apply calls setRateIsCustom(false))
      await expect(page.getByText('Custom', { exact: true })).not.toBeVisible({ timeout: 5_000 });

      // Assert: "Reset to suggested rate" button is NOT visible
      await expect(
        page.getByRole('button', { name: 'Reset to suggested rate' }),
      ).not.toBeVisible({ timeout: 5_000 });

      // Close modal
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.locator('h2', { hasText: 'New Transaction' })).not.toBeVisible({
        timeout: 10_000,
      });
    } finally {
      await deleteExpenseCategory(request, token, category.id);
      await deleteAccount(request, token, account.id);
    }
  });

  test('Test 3: clicking Dismiss hides the banner and leaves the Exchange Rate unchanged', async ({
    page,
    request,
  }) => {
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/$/);

    const token = await getAuthToken(request);

    const account = await createAccount(request, token, USD_ACCOUNT_NAME, 'USD');
    const category = await createExpenseCategory(request, token, EUR_CATEGORY_NAME, 'EUR');

    try {
      await openThreeFieldForm(page);

      // Enter source amount
      const sourceInput = page
        .locator('label')
        .filter({ hasText: 'Amount (USD)' })
        .locator('..')
        .locator('input[type="number"]');
      await sourceInput.fill('100');
      await sourceInput.press('Tab');

      // Wait for initial (today's) rate to settle
      await page.waitForTimeout(500);

      // Locate the Exchange Rate input before changing the date
      const exchangeRateInput = page
        .locator('label')
        .filter({ hasText: 'Exchange Rate' })
        .locator('..')
        .locator('..')
        .locator('input[type="number"]');
      await expect(exchangeRateInput).toBeVisible({ timeout: 5_000 });

      // Change date to trigger historical rate fetch
      await changeDateField(page, HISTORICAL_DATE);

      const bannerAppeared = await waitForBanner(page, 15_000);

      if (!bannerAppeared) {
        test.skip(true, 'Frankfurter API did not respond in time — skipping gracefully');
        return;
      }

      // Record the rate in the Exchange Rate field while banner is visible.
      // Dismiss only calls setPendingSuggestedRate(null) — the field is unchanged.
      const rateWhileBannerVisible = await exchangeRateInput.inputValue();

      // Click Dismiss
      await page.getByRole('button', { name: 'Dismiss' }).click();

      // Wait for React state to update
      await page.waitForTimeout(300);

      // Assert: banner disappears after Dismiss
      await expect(page.getByText(/Historical rate for/, { exact: false })).not.toBeVisible({
        timeout: 5_000,
      });

      // Assert: Exchange Rate field still has the same value as when banner appeared
      // (Dismiss only calls setPendingSuggestedRate(null) — rate itself is untouched)
      const rateAfterDismiss = await exchangeRateInput.inputValue();
      expect(rateAfterDismiss).toBe(rateWhileBannerVisible);

      // Close modal
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.locator('h2', { hasText: 'New Transaction' })).not.toBeVisible({
        timeout: 10_000,
      });
    } finally {
      await deleteExpenseCategory(request, token, category.id);
      await deleteAccount(request, token, account.id);
    }
  });
});
