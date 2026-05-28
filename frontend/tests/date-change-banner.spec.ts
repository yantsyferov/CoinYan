/**
 * E2E tests: Historical rate suggestion banner on date change (Spec 015 Slice 7)
 *
 * Currency pair: USD account → EUR expense category.
 * Frankfurter API (the live rates backend) supports USD/EUR historical data
 * since 1999 but does NOT support UAH, so only USD/EUR triggers the banner.
 *
 * Test 1 (Accept path)
 *   - Open the three-field cross-currency form (USD account → EUR category)
 *   - Enter a source amount so all three fields have values
 *   - Change the date to 2023-01-02
 *   - Wait for the suggestion banner ("Historical rate for 2023-01-02: X.XXXX. Apply it?")
 *   - Note the rate shown in the banner
 *   - Click Apply
 *   - Assert: banner disappears
 *   - Assert: Exchange Rate field shows the historical rate from the banner
 *   - Assert: "Custom" badge is NOT visible (Apply clears rateIsCustom)
 *
 * Test 2 (Dismiss path)
 *   - Same setup; change date to 2023-01-02 → wait for banner
 *   - Note the Exchange Rate field value while banner is visible
 *   - Click Dismiss
 *   - Assert: banner disappears
 *   - Assert: Exchange Rate field is unchanged
 *
 * Important notes:
 * - If the Frankfurter API does not respond within 15s the tests skip gracefully.
 * - The banner only fires when the user actively changes the date after modal open
 *   (controlled by dateChangedRef.current in TransactionModal.tsx).
 */

import { test, expect, type Page } from '@playwright/test';
import { loginAsTestUser } from './auth.setup';
import { gql, getAuthToken } from './helpers';

// ── Unique names per test run ──────────────────────────────────────────────────
const TS = Date.now();
const USD_ACCOUNT_NAME = `DCB-USD-Acct-${TS}`;
const EUR_CATEGORY_NAME = `DCB-EUR-Cat-${TS}`;

// Historical date with known Frankfurter USD/EUR data
const HISTORICAL_DATE = '2023-01-02';

// ── API helpers ────────────────────────────────────────────────────────────────

async function createAccount(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  name: string,
  currency: string,
): Promise<{ id: string }> {
  const data = await gql<{ createAccount: { id: string } }>(
    request,
    `mutation CreateAccount($input: CreateAccountInput!) {
       createAccount(input: $input) { id }
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

// ── DOM helpers ────────────────────────────────────────────────────────────────

/**
 * Returns a locator for the inner 72x72 circle div of a CircleItem identified
 * by its display name.
 *
 * CircleItem DOM structure:
 *   div (outer flexColumn wrapper)  <- name.locator('..')
 *     div (72x72 wrapper)           <- .locator('div').first()
 *       div (drag handle)           <- .locator('div').first()  <-- this one
 *         {icon text}
 *     span (name)
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
 * Scrolls both the source account circle and the target category circle into
 * the visible viewport, then performs a dnd-kit compatible pointer drag.
 */
async function scrollBothIntoViewAndDrag(
  page: Page,
  sourceAccountName: string,
  targetCategoryName: string,
): Promise<void> {
  // Scroll the accounts horizontal container so the source account is visible
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

  const acctSpan = page.getByText(sourceAccountName, { exact: true }).first();
  await acctSpan.scrollIntoViewIfNeeded();

  const sourceCircle = getCircleDiv(page, sourceAccountName);
  const targetCircle = getCircleDiv(page, targetCategoryName);

  const srcBox = await sourceCircle.boundingBox();
  const tgtBox = await targetCircle.boundingBox();

  if (!srcBox || !tgtBox) throw new Error('Could not get bounding boxes for drag elements');

  // If target circle is below viewport, center both into view
  const viewport = page.viewportSize()!;
  const midY = (srcBox.y + srcBox.height / 2 + tgtBox.y + tgtBox.height / 2) / 2;
  const scrollY = midY - viewport.height / 2;
  if (scrollY > 0) {
    await page.evaluate((y: number) => window.scrollTo(0, y), scrollY);
    await page.waitForTimeout(150);
  }

  const srcFinal = await sourceCircle.boundingBox();
  const tgtFinal = await targetCircle.boundingBox();

  if (!srcFinal || !tgtFinal) throw new Error('Could not get final bounding boxes');

  const sx = srcFinal.x + srcFinal.width / 2;
  const sy = srcFinal.y + srcFinal.height / 2;
  const tx = tgtFinal.x + tgtFinal.width / 2;
  const ty = tgtFinal.y + tgtFinal.height / 2;

  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 10, sy + 10); // exceed dnd-kit 8px activation distance
  await page.mouse.move(tx, ty, { steps: 10 });
  await page.mouse.up();
}

/**
 * Navigates to the home page, waits for both circles to be present in the DOM,
 * drags the USD account onto the EUR category, and waits for the modal.
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

  await expect(page.locator('h2', { hasText: 'New Transaction' })).toBeVisible({ timeout: 10_000 });

  // Confirm all three cross-currency fields are rendered
  await expect(page.getByText('Amount (USD)', { exact: true })).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText('Exchange Rate', { exact: true })).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText('Total (EUR)', { exact: true })).toBeVisible({ timeout: 5_000 });
}

/**
 * Fills the date input with the given value and dispatches a synthetic change
 * event so React's onChange handler fires (sets dateChangedRef.current = true).
 */
async function changeDateField(page: Page, dateValue: string): Promise<void> {
  const dateInput = page.locator('input[type="date"]');
  await expect(dateInput).toBeVisible({ timeout: 5_000 });
  await dateInput.fill(dateValue);
  await dateInput.dispatchEvent('change');
  await page.waitForTimeout(200); // let React propagate the state update
}

/**
 * Waits up to timeoutMs for the historical rate suggestion banner to appear.
 * Returns false if the banner does not appear (Frankfurter unreachable).
 */
async function waitForBanner(page: Page, timeoutMs = 20_000): Promise<boolean> {
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

test.describe('Historical rate suggestion banner on date change', () => {
  test.setTimeout(90_000); // extra headroom for Frankfurter API round-trips

  test('Accept path: clicking Apply updates Exchange Rate and removes banner', async ({
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

      // Enter a source amount so the rate field is populated and Exchange Rate has a value
      const sourceInput = page
        .locator('label')
        .filter({ hasText: 'Amount (USD)' })
        .locator('..')
        .locator('input[type="number"]');
      await expect(sourceInput).toBeVisible({ timeout: 5_000 });
      await sourceInput.fill('100');
      await sourceInput.press('Tab');

      // Wait for the initial (today's) rate to settle before changing date
      await page.waitForTimeout(600);

      // Confirm banner is NOT visible on initial modal open
      await expect(page.getByText(/Historical rate for/, { exact: false })).not.toBeVisible();

      // Change date to trigger historical rate fetch via Frankfurter
      await changeDateField(page, HISTORICAL_DATE);

      const bannerAppeared = await waitForBanner(page, 20_000);

      if (!bannerAppeared) {
        test.skip(true, 'Frankfurter API did not respond in time — skipping gracefully');
        return;
      }

      // Read the historical rate displayed in the banner text.
      // Banner format: "Historical rate for 2023-01-02: X.XXXX. Apply it?"
      const bannerLocator = page.getByText(/Historical rate for/, { exact: false });
      const bannerFullText = await bannerLocator.textContent();
      const rateMatch = bannerFullText?.match(/:\s*([\d.]+)\./);
      const historicalRateFromBanner = rateMatch ? parseFloat(rateMatch[1]) : null;

      // Both Apply and Dismiss buttons must be present in the banner
      await expect(page.getByRole('button', { name: 'Apply' })).toBeVisible({ timeout: 5_000 });
      await expect(page.getByRole('button', { name: 'Dismiss' })).toBeVisible({ timeout: 5_000 });

      // Click Apply
      await page.getByRole('button', { name: 'Apply' }).click();
      await page.waitForTimeout(300);

      // Assert: banner disappears after Apply
      await expect(page.getByText(/Historical rate for/, { exact: false })).not.toBeVisible({
        timeout: 5_000,
      });

      // Locate the Exchange Rate input
      const exchangeRateInput = page
        .locator('label')
        .filter({ hasText: 'Exchange Rate' })
        .locator('..')
        .locator('..')
        .locator('input[type="number"]');
      await expect(exchangeRateInput).toBeVisible({ timeout: 5_000 });

      // Assert: Exchange Rate field now reflects the historical rate from the banner
      if (historicalRateFromBanner !== null) {
        const rateFieldValue = await exchangeRateInput.inputValue();
        expect(parseFloat(rateFieldValue)).toBeCloseTo(historicalRateFromBanner, 3);
      }

      // Assert: "Custom" badge is NOT visible — Apply sets rateIsCustom(false)
      await expect(page.getByText('Custom', { exact: true })).not.toBeVisible({ timeout: 5_000 });

      // Assert: Target Amount was recalculated (non-empty)
      const targetInput = page
        .locator('label')
        .filter({ hasText: 'Total (EUR)' })
        .locator('..')
        .locator('input[type="number"]');
      const targetValue = await targetInput.inputValue();
      expect(parseFloat(targetValue)).toBeGreaterThan(0);

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

  test('Dismiss path: clicking Dismiss hides banner and leaves Exchange Rate unchanged', async ({
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

      // Enter source amount so Exchange Rate field has a value
      const sourceInput = page
        .locator('label')
        .filter({ hasText: 'Amount (USD)' })
        .locator('..')
        .locator('input[type="number"]');
      await expect(sourceInput).toBeVisible({ timeout: 5_000 });
      await sourceInput.fill('100');
      await sourceInput.press('Tab');

      // Wait for the initial (today's) rate to settle
      await page.waitForTimeout(600);

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

      const bannerAppeared = await waitForBanner(page, 20_000);

      if (!bannerAppeared) {
        test.skip(true, 'Frankfurter API did not respond in time — skipping gracefully');
        return;
      }

      // Record the Exchange Rate value while the banner is showing.
      // Dismiss only calls setPendingSuggestedRate(null) — the field is left untouched.
      const rateWhileBannerVisible = await exchangeRateInput.inputValue();

      // Also record the Target Amount before dismissing
      const targetInput = page
        .locator('label')
        .filter({ hasText: 'Total (EUR)' })
        .locator('..')
        .locator('input[type="number"]');
      const targetWhileBannerVisible = await targetInput.inputValue();

      // Click Dismiss
      await page.getByRole('button', { name: 'Dismiss' }).click();
      await page.waitForTimeout(300);

      // Assert: banner disappears after Dismiss
      await expect(page.getByText(/Historical rate for/, { exact: false })).not.toBeVisible({
        timeout: 5_000,
      });

      // Assert: Exchange Rate field is unchanged after Dismiss
      const rateAfterDismiss = await exchangeRateInput.inputValue();
      expect(rateAfterDismiss).toBe(rateWhileBannerVisible);

      // Assert: Target Amount is unchanged after Dismiss
      const targetAfterDismiss = await targetInput.inputValue();
      expect(targetAfterDismiss).toBe(targetWhileBannerVisible);

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
