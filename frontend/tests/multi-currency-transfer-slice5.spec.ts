/**
 * Slice 5 acceptance tests — Multi-Currency Transfer
 *
 * Test 1: Cross-currency transfer (USD account → UAH account)
 *   - Three-field form appears (Amount (USD), Exchange Rate, Amount (UAH))
 *   - Exchange Rate field pre-filled from rates service (or empty when stale)
 *   - Entering source amount auto-calculates target amount
 *   - Confirming creates the transfer; USD balance decreases, UAH balance increases
 *
 * Test 2: Same-currency transfer regression (USD account → USD account)
 *   - Only a single "Amount (USD)" field is shown — no Exchange Rate or target Amount fields
 *
 * Drag-and-drop scroll strategy
 * ──────────────────────────────
 * Both accounts live in the same horizontal-scroll Accounts row. Newly created
 * accounts appear at the far right, potentially beyond the 1280-px viewport.
 * dnd-kit's PointerSensor only fires when pointer events happen within the
 * visible viewport, so both the source and target account circles must be
 * on-screen simultaneously when the drag gesture is performed.
 *
 * Fix: (1) scroll the Accounts horizontal container so the source account is
 * visible, (2) ensure the target account is also visible by scrolling the
 * container to a position that shows both, then (3) issue mouse events using
 * final bounding boxes.
 */

import { test, expect, type Page } from '@playwright/test';
import { loginAsTestUser } from './auth.setup';
import { gql, getAuthToken } from './helpers';

// ── Unique names per test run to avoid cross-run conflicts ─────────────────────
const TS = Date.now();
const USD_ACCOUNT_NAME = `MC5-USD-Acct-${TS}`;
const UAH_ACCOUNT_NAME = `MC5-UAH-Acct-${TS}`;
const USD_ACCOUNT_NAME_2 = `MC5-USD-Acct2-${TS}`;

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
 * Scroll both account circles into the visible viewport simultaneously
 * (both live in the same horizontal-scroll Accounts section), then perform
 * a dnd-kit compatible drag from source account to target account.
 *
 * The approach:
 * 1. Scroll the Accounts horizontal container to centre the source account circle.
 * 2. Scroll the page vertically so the Accounts row is in the viewport.
 * 3. Read final bounding boxes and dispatch pointer events.
 */
async function scrollBothAccountsIntoViewAndDrag(
  page: Page,
  sourceAccountName: string,
  targetAccountName: string,
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
  }, sourceAccountName);

  // Wait briefly for scroll to settle
  await page.waitForTimeout(150);

  // Step 2: Scroll the page vertically so the source account circle is in the viewport
  const sourceSpan = page.getByText(sourceAccountName, { exact: true }).first();
  await sourceSpan.scrollIntoViewIfNeeded();

  // Get raw page-level positions of both circles
  const sourceCircle = getCircleDiv(page, sourceAccountName);
  const targetCircle = getCircleDiv(page, targetAccountName);

  const srcBox = await sourceCircle.boundingBox();
  const tgtBox = await targetCircle.boundingBox();

  if (!srcBox || !tgtBox) throw new Error('Could not get bounding boxes for drag elements');

  // Step 3: If target is out of viewport horizontally, scroll the container to show it too
  const viewport = page.viewportSize()!;
  if (tgtBox.x < 0 || tgtBox.x + tgtBox.width > viewport.width) {
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
          // Scroll to centre this element, but subtract half the container width
          el.scrollLeft = el.scrollLeft + (elRect.left - containerRect.left) - 200;
          return;
        }
        el = el.parentElement;
      }
    }, targetAccountName);
    await page.waitForTimeout(150);
  }

  // Step 4: Centre page vertically on the accounts row
  const midY = (srcBox.y + srcBox.height / 2 + tgtBox.y + tgtBox.height / 2) / 2;
  const scrollY = midY - viewport.height / 2;
  if (scrollY > 0) {
    await page.evaluate((y: number) => window.scrollTo(0, y), scrollY);
    await page.waitForTimeout(150); // allow scroll to settle
  }

  // Step 5: Get final bounding boxes and perform the drag
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

test.describe('Slice 5 — Multi-currency transfer form', () => {
  test('Test 1: cross-currency — drag USD account onto UAH account shows three-field form, auto-calculates target amount, and creates transfer', async ({
    page,
    request,
  }) => {
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/$/);

    const token = await getAuthToken(request);

    // Create isolated test data via API
    const usdAccount = await createAccount(request, token, USD_ACCOUNT_NAME, 'USD', 500);
    const uahAccount = await createAccount(request, token, UAH_ACCOUNT_NAME, 'UAH', 1000);

    try {
      // Navigate to home and wait for both account circles to appear in the DOM
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(USD_ACCOUNT_NAME, { exact: true }).first()).toBeAttached({
        timeout: 15_000,
      });
      await expect(page.getByText(UAH_ACCOUNT_NAME, { exact: true }).first()).toBeAttached({
        timeout: 15_000,
      });

      // Perform drag: USD account → UAH account
      await scrollBothAccountsIntoViewAndDrag(page, USD_ACCOUNT_NAME, UAH_ACCOUNT_NAME);

      // ── Assertion 1: TransferModal opens (title is "Transfer") ─────────────────
      const modal = page.locator('h2', { hasText: 'Transfer' });
      await expect(modal).toBeVisible({ timeout: 10_000 });

      // ── Assertion 2: Three fields — Amount (USD), Exchange Rate, Amount (UAH) ──
      await expect(page.getByText('Amount (USD)', { exact: true })).toBeVisible({ timeout: 5_000 });
      await expect(page.getByText('Exchange Rate', { exact: true })).toBeVisible({ timeout: 5_000 });
      await expect(page.getByText('Amount (UAH)', { exact: true })).toBeVisible({ timeout: 5_000 });

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
      await sourceInput.fill('100');

      const targetInput = page
        .locator('label')
        .filter({ hasText: 'Amount (UAH)' })
        .locator('..')
        .locator('input[type="number"]');
      await expect(targetInput).toBeVisible();

      // React's useEffect calculates target = source × rate
      await expect(targetInput).not.toHaveValue('', { timeout: 5_000 });
      await expect(targetInput).not.toHaveValue('0', { timeout: 5_000 });
      const computedTarget = parseFloat(await targetInput.inputValue());
      expect(computedTarget).toBeGreaterThan(0);
      expect(computedTarget).toBeCloseTo(100 * usedRate, 0);

      // ── Read account balances before confirming (via API) ─────────────────────
      const beforeData = await gql<{ accounts: Array<{ id: string; currentBalance: number }> }>(
        request,
        '{ accounts { id currentBalance } }',
        undefined,
        token,
      );
      const usdBalanceBefore =
        beforeData.accounts.find((a) => a.id === usdAccount.id)?.currentBalance ?? 0;
      const uahBalanceBefore =
        beforeData.accounts.find((a) => a.id === uahAccount.id)?.currentBalance ?? 0;

      // ── Assertion 5: Confirm → modal closes ───────────────────────────────────
      const confirmBtn = page.getByRole('button', { name: 'Confirm' });
      await expect(confirmBtn).toBeEnabled({ timeout: 5_000 });
      await confirmBtn.click();
      await expect(modal).not.toBeVisible({ timeout: 10_000 });

      // ── Assertion 6: USD balance decreased by 100, UAH balance increased by computed target ──
      const afterData = await gql<{ accounts: Array<{ id: string; currentBalance: number }> }>(
        request,
        '{ accounts { id currentBalance } }',
        undefined,
        token,
      );
      const usdBalanceAfter =
        afterData.accounts.find((a) => a.id === usdAccount.id)?.currentBalance ?? 0;
      const uahBalanceAfter =
        afterData.accounts.find((a) => a.id === uahAccount.id)?.currentBalance ?? 0;

      expect(usdBalanceAfter).toBeCloseTo(usdBalanceBefore - 100, 1);
      expect(uahBalanceAfter).toBeCloseTo(uahBalanceBefore + computedTarget, 1);
    } finally {
      await deleteAccount(request, token, usdAccount.id);
      await deleteAccount(request, token, uahAccount.id);
    }
  });

  test('Test 2: same-currency regression — drag USD account onto USD account shows only a single amount field', async ({
    page,
    request,
  }) => {
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/$/);

    const token = await getAuthToken(request);

    // Create two isolated USD accounts via API
    const usdAccount1 = await createAccount(request, token, USD_ACCOUNT_NAME, 'USD', 500);
    const usdAccount2 = await createAccount(request, token, USD_ACCOUNT_NAME_2, 'USD', 300);

    try {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(USD_ACCOUNT_NAME, { exact: true }).first()).toBeAttached({
        timeout: 15_000,
      });
      await expect(page.getByText(USD_ACCOUNT_NAME_2, { exact: true }).first()).toBeAttached({
        timeout: 15_000,
      });

      // Perform drag: first USD account → second USD account
      await scrollBothAccountsIntoViewAndDrag(page, USD_ACCOUNT_NAME, USD_ACCOUNT_NAME_2);

      // ── Assertion 1: TransferModal opens (title is "Transfer") ─────────────────
      const modal = page.locator('h2', { hasText: 'Transfer' });
      await expect(modal).toBeVisible({ timeout: 10_000 });

      // ── Assertion 2: Single "Amount (USD)" label (with currency suffix) ────────
      // The same-currency TransferModal shows Amount({fromAccount.currency})
      await expect(page.getByText('Amount (USD)', { exact: true })).toBeVisible({ timeout: 5_000 });

      // ── Assertion 3: NO Exchange Rate field ────────────────────────────────────
      await expect(page.getByText('Exchange Rate', { exact: true })).not.toBeVisible();

      // ── Assertion 4: Only ONE "Amount (USD)" label — no second amount field ────
      // (Verify there's only one amount label, not two)
      const allAmountLabels = page.locator('label', { hasText: 'Amount (USD)' });
      await expect(allAmountLabels).toHaveCount(1);

      // Close the modal — use the Cancel button directly (it's unambiguous when the modal is open)
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(modal).not.toBeVisible({ timeout: 10_000 });
    } finally {
      await deleteAccount(request, token, usdAccount1.id);
      await deleteAccount(request, token, usdAccount2.id);
    }
  });
});
