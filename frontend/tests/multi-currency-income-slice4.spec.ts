/**
 * Slice 4 acceptance tests — Multi-Currency Income
 *
 * Test 1: Cross-currency income (EUR income source → USD account)
 *   - Three-field form appears (Amount (EUR), Exchange Rate, Total (USD))
 *   - Exchange Rate field pre-filled from rates service (or empty when stale)
 *   - Entering source amount auto-calculates target amount
 *   - Confirming creates the transaction; account balance increases
 *
 * Test 2: Same-currency income regression (USD income source → USD account)
 *   - Only a single "Amount" field is shown — no Exchange Rate or Total fields
 *
 * Drag-and-drop scroll strategy
 * ──────────────────────────────
 * Income sources are displayed in a wrapped grid (Income Sources section).
 * Accounts are in a horizontal-scroll row (Accounts section).
 * Newly created accounts may be off-screen to the right.
 *
 * The drag direction is: income source circle → account circle.
 * We must ensure both are visible simultaneously in the viewport before
 * issuing mouse events, because dnd-kit's PointerSensor only fires for
 * events within the visible viewport.
 *
 * Fix: (1) Scroll the accounts horizontal container so the target account
 * is visible, (2) scroll the page vertically so both circles are on-screen
 * at the same time before performing the drag gesture.
 */

import { test, expect, type Page } from '@playwright/test';
import { loginAsTestUser } from './auth.setup';
import { gql, getAuthToken } from './helpers';

// ── Unique names per test run to avoid cross-run conflicts ─────────────────────
const TS = Date.now();
const EUR_SOURCE_NAME = `MC4-EUR-Src-${TS}`;
const USD_ACCOUNT_NAME_CROSS = `MC4-USD-Acct-Cross-${TS}`;
const USD_SOURCE_NAME = `MC4-USD-Src-${TS}`;
const USD_ACCOUNT_NAME_SAME = `MC4-USD-Acct-Same-${TS}`;

// ── API helpers ────────────────────────────────────────────────────────────────

async function createAccount(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  name: string,
  currency: string,
  startingBalance = 0,
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

async function createIncomeSource(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  name: string,
  currency: string,
): Promise<{ id: string; name: string; currency: string }> {
  const data = await gql<{
    createIncomeSource: { id: string; name: string; currency: string };
  }>(
    request,
    `mutation CreateIncomeSource($input: CreateCategoryInput!) {
       createIncomeSource(input: $input) { id name currency }
     }`,
    { input: { name, icon: 'cash', currency } },
    token,
  );
  return data.createIncomeSource;
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

/**
 * Returns a locator for the 72×72 drag/drop circle of a CircleItem.
 *
 * CircleItem DOM structure:
 *   div (outer flexColumn wrapper)            ← name.locator('..')
 *     div (position:relative 72×72 wrapper)   ← .locator('div').first()
 *       div (dragRef — actual circle div)     ← .locator('div').first()  ← THIS
 *         {icon text}
 *     span (name)                             ← matched by getByText
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
 * Scroll the source income circle and the target account circle into the
 * visible viewport simultaneously, then perform a dnd-kit compatible drag.
 *
 * Direction: income source → account (opposite of Slice 3 expense flow).
 *
 * The approach:
 * 1. Scroll the page vertically so the income source is visible.
 * 2. Scroll the Accounts horizontal scroll-container so the target account
 *    circle is visible within that container.
 * 3. Compute a page Y-position that centres both circles in the viewport.
 * 4. Read final bounding boxes and dispatch pointer events.
 */
async function scrollBothIntoViewAndDrag(
  page: Page,
  sourceIncomeName: string,
  targetAccountName: string,
): Promise<void> {
  // Step 1: Scroll the income source span into view first
  const sourceSpan = page.getByText(sourceIncomeName, { exact: true }).first();
  await sourceSpan.scrollIntoViewIfNeeded();

  // Step 2: Scroll the Accounts horizontal container to show the target account
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

    // Walk up to find the nearest horizontally-scrolling ancestor
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
  }, targetAccountName);

  // Step 3: Scroll page vertically to centre both circles in the viewport
  const sourceCircle = getCircleDiv(page, sourceIncomeName);
  const targetCircle = getCircleDiv(page, targetAccountName);

  const srcBox = await sourceCircle.boundingBox();
  const tgtBox = await targetCircle.boundingBox();

  if (!srcBox || !tgtBox) throw new Error('Could not get bounding boxes for drag elements');

  const viewport = page.viewportSize()!;
  const midY = (srcBox.y + srcBox.height / 2 + tgtBox.y + tgtBox.height / 2) / 2;
  const scrollY = midY - viewport.height / 2;
  if (scrollY > 0) {
    await page.evaluate((y: number) => window.scrollTo(0, y), scrollY);
    await page.waitForTimeout(150); // allow scroll to settle
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

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe('Slice 4 — Multi-currency income form', () => {
  test('Test 1: cross-currency — drag EUR income source onto USD account shows three-field form, auto-calculates total amount, and creates transaction', async ({
    page,
    request,
  }) => {
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/$/);

    const token = await getAuthToken(request);

    // Create isolated test data via API
    const source = await createIncomeSource(request, token, EUR_SOURCE_NAME, 'EUR');
    const account = await createAccount(request, token, USD_ACCOUNT_NAME_CROSS, 'USD', 500);

    try {
      // Navigate to home and wait for both circles to appear in the DOM
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(EUR_SOURCE_NAME, { exact: true }).first()).toBeAttached({
        timeout: 15_000,
      });
      await expect(page.getByText(USD_ACCOUNT_NAME_CROSS, { exact: true }).first()).toBeAttached({
        timeout: 15_000,
      });

      // Perform drag: EUR income source → USD account
      await scrollBothIntoViewAndDrag(page, EUR_SOURCE_NAME, USD_ACCOUNT_NAME_CROSS);

      // ── Assertion 1: TransactionModal opens ───────────────────────────────────
      const modal = page.locator('h2', { hasText: 'New Transaction' });
      await expect(modal).toBeVisible({ timeout: 10_000 });

      // ── Assertion 2: Three fields — Amount (EUR), Exchange Rate, Total (USD) ──
      await expect(page.getByText('Amount (EUR)', { exact: true })).toBeVisible({ timeout: 5_000 });
      await expect(page.getByText('Exchange Rate', { exact: true })).toBeVisible({ timeout: 5_000 });
      await expect(page.getByText('Total (USD)', { exact: true })).toBeVisible({ timeout: 5_000 });

      // ── Assertion 3: Exchange rate field is present (pre-filled or empty) ─────
      const exchangeRateInput = page
        .locator('label')
        .filter({ hasText: 'Exchange Rate' })
        .locator('..')
        .locator('input[type="number"]');
      await expect(exchangeRateInput).toBeVisible({ timeout: 5_000 });

      // Accept live rate if available; fall back to manual entry if rates service
      // returns null (stale).
      const rateValue = await exchangeRateInput.inputValue();
      let usedRate: number;
      if (rateValue && parseFloat(rateValue) > 0) {
        usedRate = parseFloat(rateValue);
        expect(usedRate).toBeGreaterThan(0);
      } else {
        usedRate = 1.08; // approximate EUR→USD, used only for test arithmetic
        await exchangeRateInput.fill(String(usedRate));
      }

      // ── Assertion 4: Enter source amount → target auto-calculates ─────────────
      const sourceInput = page
        .locator('label')
        .filter({ hasText: 'Amount (EUR)' })
        .locator('..')
        .locator('input[type="number"]');
      await expect(sourceInput).toBeVisible();
      await sourceInput.fill('100');

      const targetInput = page
        .locator('label')
        .filter({ hasText: 'Total (USD)' })
        .locator('..')
        .locator('input[type="number"]');
      await expect(targetInput).toBeVisible();

      // React's useEffect calculates target = source × rate
      await expect(targetInput).not.toHaveValue('', { timeout: 5_000 });
      await expect(targetInput).not.toHaveValue('0', { timeout: 5_000 });
      const computedTarget = parseFloat(await targetInput.inputValue());
      expect(computedTarget).toBeGreaterThan(0);
      expect(computedTarget).toBeCloseTo(100 * usedRate, 0);

      // ── Read account balance before confirming (via API) ───────────────────────
      const beforeData = await gql<{ accounts: Array<{ id: string; currentBalance: number }> }>(
        request,
        '{ accounts { id currentBalance } }',
        undefined,
        token,
      );
      const balanceBefore =
        beforeData.accounts.find((a) => a.id === account.id)?.currentBalance ?? 0;

      // ── Assertion 5: Confirm → modal closes ──────────────────────────────────
      const confirmBtn = page.getByRole('button', { name: 'Confirm' });
      await expect(confirmBtn).toBeEnabled({ timeout: 5_000 });
      await confirmBtn.click();
      await expect(modal).not.toBeVisible({ timeout: 10_000 });

      // ── Assertion 6: Account balance increased by the USD-equivalent amount ───
      const afterData = await gql<{ accounts: Array<{ id: string; currentBalance: number }> }>(
        request,
        '{ accounts { id currentBalance } }',
        undefined,
        token,
      );
      const balanceAfter =
        afterData.accounts.find((a) => a.id === account.id)?.currentBalance ?? 0;

      // Balance should have increased by the target (USD) amount
      expect(balanceAfter).toBeGreaterThan(balanceBefore);
      expect(balanceAfter - balanceBefore).toBeCloseTo(computedTarget, 1);
    } finally {
      await deleteIncomeSource(request, token, source.id);
      await deleteAccount(request, token, account.id);
    }
  });

  test('Test 2: same-currency regression — drag USD income source onto USD account shows only a single amount field', async ({
    page,
    request,
  }) => {
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/$/);

    const token = await getAuthToken(request);

    const source = await createIncomeSource(request, token, USD_SOURCE_NAME, 'USD');
    const account = await createAccount(request, token, USD_ACCOUNT_NAME_SAME, 'USD', 0);

    try {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(USD_SOURCE_NAME, { exact: true }).first()).toBeAttached({
        timeout: 15_000,
      });
      await expect(page.getByText(USD_ACCOUNT_NAME_SAME, { exact: true }).first()).toBeAttached({
        timeout: 15_000,
      });

      // Perform drag: USD income source → USD account
      await scrollBothIntoViewAndDrag(page, USD_SOURCE_NAME, USD_ACCOUNT_NAME_SAME);

      // ── Assertion 1: TransactionModal opens ───────────────────────────────────
      const modal = page.locator('h2', { hasText: 'New Transaction' });
      await expect(modal).toBeVisible({ timeout: 10_000 });

      // ── Assertion 2: Single "Amount" label (no currency suffix) ───────────────
      await expect(page.getByText('Amount', { exact: true })).toBeVisible({ timeout: 5_000 });

      // ── Assertion 3: NO Exchange Rate field ────────────────────────────────────
      await expect(page.getByText('Exchange Rate', { exact: true })).not.toBeVisible();

      // ── Assertion 4: NO Total (xxx) field ─────────────────────────────────────
      await expect(page.locator('label', { hasText: /^Total \(/ })).not.toBeVisible();

      // ── Assertion 5: NO "Amount (USD)" — no currency suffix on the label ──────
      await expect(page.getByText('Amount (USD)', { exact: true })).not.toBeVisible();

      // Close the modal
      const modalContainer = page.locator('div').filter({ hasText: 'New Transaction' }).last();
      await modalContainer.getByRole('button', { name: 'Cancel' }).click();
      await expect(modal).not.toBeVisible({ timeout: 10_000 });
    } finally {
      await deleteIncomeSource(request, token, source.id);
      await deleteAccount(request, token, account.id);
    }
  });
});
