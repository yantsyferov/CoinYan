/**
 * Slice 3 acceptance tests — Multi-Currency Expense
 *
 * Test 1: Cross-currency expense (USD account → UAH category)
 *   - Three-field form appears (Source Amount, Exchange Rate, Target Amount)
 *   - Exchange Rate field pre-filled from rates service (or empty when stale)
 *   - Entering source amount auto-calculates target amount
 *   - Confirming creates the transaction; account balance decreases
 *
 * Test 2: Same-currency expense regression (USD account → USD category)
 *   - Only a single "Amount" field is shown — no Exchange Rate / Total fields
 *
 * Drag-and-drop scroll strategy
 * ──────────────────────────────
 * The Accounts section is a horizontal-scroll row. Newly created accounts
 * appear at the far right, often beyond the 1280-px viewport. At the same
 * time, the Expense Categories section is a wrapped grid that may extend
 * below the viewport depending on how many categories exist.
 *
 * dnd-kit's PointerSensor only fires when pointer events happen within the
 * visible viewport, so both source and target elements must be on-screen
 * simultaneously when the drag gesture is performed.
 *
 * Fix: (1) use JS to scroll the accounts scroll-container horizontally so the
 * test account is in view, then (2) scroll the whole page to a Y position
 * that centres both the account circle and the category circle within the
 * viewport before issuing mouse events.
 */

import { test, expect, type Page } from '@playwright/test';
import { loginAsTestUser } from './auth.setup';
import { gql, getAuthToken } from './helpers';

// ── Unique names per test run to avoid cross-run conflicts ─────────────────────
const TS = Date.now();
const USD_ACCOUNT_NAME = `MC3-USD-Acct-${TS}`;
const UAH_CATEGORY_NAME = `MC3-UAH-Cat-${TS}`;
const USD_CATEGORY_NAME = `MC3-USD-Cat-${TS}`;

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
 * Scroll both a source account circle and a target category circle into the
 * visible viewport simultaneously, then perform a dnd-kit compatible drag.
 *
 * The approach:
 * 1. Horizontally scroll the Accounts scroll-container so the source account
 *    circle is visible within that container.
 * 2. Scroll the page (window) vertically to a Y-position that centres both
 *    circles in the 720-px viewport.
 * 3. Read final bounding boxes and dispatch pointer events.
 */
async function scrollBothIntoViewAndDrag(
  page: Page,
  sourceAccountName: string,
  targetCategoryName: string,
): Promise<void> {
  // Step 1: Scroll the accounts horizontal container to show the source account
  await page.evaluate((name: string) => {
    // Find the span whose text matches the account name
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
        // Scroll so the target is centred (with 100 px left margin)
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

  // Get raw page-level positions of both circles
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

test.describe('Slice 3 — Multi-currency expense form', () => {
  test('Test 1: cross-currency — drag USD account onto UAH category shows three-field form, auto-calculates target amount, and creates transaction', async ({
    page,
    request,
  }) => {
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/$/);

    const token = await getAuthToken(request);

    // Create isolated test data via API
    const account = await createAccount(request, token, USD_ACCOUNT_NAME, 'USD');
    const category = await createExpenseCategory(request, token, UAH_CATEGORY_NAME, 'UAH');

    try {
      // Navigate to home and wait for both circles to appear in the DOM
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(USD_ACCOUNT_NAME, { exact: true }).first()).toBeAttached({
        timeout: 15_000,
      });
      await expect(page.getByText(UAH_CATEGORY_NAME, { exact: true }).first()).toBeAttached({
        timeout: 15_000,
      });

      // Perform drag: USD account → UAH expense category
      // (handles horizontal scroll of accounts section + vertical page scroll)
      await scrollBothIntoViewAndDrag(page, USD_ACCOUNT_NAME, UAH_CATEGORY_NAME);

      // ── Assertion 1: TransactionModal opens ────────────────────────────────────
      const modal = page.locator('h2', { hasText: 'New Transaction' });
      await expect(modal).toBeVisible({ timeout: 10_000 });

      // ── Assertion 2: Three fields — Source Amount, Exchange Rate, Total ────────
      await expect(page.getByText('Amount (USD)', { exact: true })).toBeVisible({ timeout: 5_000 });
      await expect(page.getByText('Exchange Rate', { exact: true })).toBeVisible({ timeout: 5_000 });
      await expect(page.getByText('Total (UAH)', { exact: true })).toBeVisible({ timeout: 5_000 });

      // ── Assertion 3: Exchange rate field is present (pre-filled or empty) ──────
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
        usedRate = 41.5; // approximate USD→UAH, used only for test arithmetic
        await exchangeRateInput.fill(String(usedRate));
      }

      // ── Assertion 4: Enter source amount → target auto-calculates ─────────────
      const sourceInput = page
        .locator('label')
        .filter({ hasText: 'Amount (USD)' })
        .locator('..')
        .locator('input[type="number"]');
      await expect(sourceInput).toBeVisible();
      await sourceInput.fill('10');

      const targetInput = page
        .locator('label')
        .filter({ hasText: 'Total (UAH)' })
        .locator('..')
        .locator('input[type="number"]');
      await expect(targetInput).toBeVisible();

      // React's useEffect calculates target = source × rate
      await expect(targetInput).not.toHaveValue('', { timeout: 5_000 });
      await expect(targetInput).not.toHaveValue('0', { timeout: 5_000 });
      const computedTarget = parseFloat(await targetInput.inputValue());
      expect(computedTarget).toBeGreaterThan(0);
      expect(computedTarget).toBeCloseTo(10 * usedRate, 0);

      // ── Read account balance before confirming (via API) ──────────────────────
      const beforeData = await gql<{ accounts: Array<{ id: string; currentBalance: number }> }>(
        request,
        '{ accounts { id currentBalance } }',
        undefined,
        token,
      );
      const balanceBefore =
        beforeData.accounts.find((a) => a.id === account.id)?.currentBalance ?? 0;

      // ── Assertion 5: Confirm → modal closes ───────────────────────────────────
      const confirmBtn = page.getByRole('button', { name: 'Confirm' });
      await expect(confirmBtn).toBeEnabled({ timeout: 5_000 });
      await confirmBtn.click();
      await expect(modal).not.toBeVisible({ timeout: 10_000 });

      // ── Assertion 6: Account balance decreased by 10 USD ─────────────────────
      const afterData = await gql<{ accounts: Array<{ id: string; currentBalance: number }> }>(
        request,
        '{ accounts { id currentBalance } }',
        undefined,
        token,
      );
      const balanceAfter =
        afterData.accounts.find((a) => a.id === account.id)?.currentBalance ?? 0;
      expect(balanceAfter).toBeCloseTo(balanceBefore - 10, 1);
    } finally {
      await deleteExpenseCategory(request, token, category.id);
      await deleteAccount(request, token, account.id);
    }
  });

  test('Test 2: same-currency regression — drag USD account onto USD category shows only a single amount field', async ({
    page,
    request,
  }) => {
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/$/);

    const token = await getAuthToken(request);

    // Distinct suffix to avoid name collision with Test 1
    const account = await createAccount(request, token, `${USD_ACCOUNT_NAME}-2`, 'USD');
    const category = await createExpenseCategory(request, token, USD_CATEGORY_NAME, 'USD');

    try {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(account.name, { exact: true }).first()).toBeAttached({
        timeout: 15_000,
      });
      await expect(page.getByText(USD_CATEGORY_NAME, { exact: true }).first()).toBeAttached({
        timeout: 15_000,
      });

      // Perform drag: USD account → USD expense category
      await scrollBothIntoViewAndDrag(page, account.name, USD_CATEGORY_NAME);

      // ── Assertion 1: TransactionModal opens ────────────────────────────────────
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

      // Close the modal — scope the Cancel button to the modal container to avoid
      // ambiguity if other Cancel buttons are present on the page
      const modalContainer = page.locator('div').filter({ hasText: 'New Transaction' }).last();
      await modalContainer.getByRole('button', { name: 'Cancel' }).click();
      await expect(modal).not.toBeVisible({ timeout: 10_000 });
    } finally {
      await deleteExpenseCategory(request, token, category.id);
      await deleteAccount(request, token, account.id);
    }
  });
});
