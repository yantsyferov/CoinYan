import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './auth.setup';
import { gql, getAuthToken, ensureIncomeSource } from './helpers';

const YEAR_STRING = '2026';

/**
 * Creates a fresh isolated account with zero starting balance.
 * No "Initial balance" transaction is injected, keeping the list clean.
 */
async function createFreshAccount(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  suffix: string,
): Promise<{ id: string; name: string }> {
  const name = `PW Cancel-Reset ${suffix}`;
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

/**
 * Creates an income transaction with a specific transactionDate via GraphQL.
 * Returns the note used so the test can locate the row later.
 */
async function createDatedIncomeTransaction(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  sourceId: string,
  accountId: string,
  amount: number,
  note: string,
  transactionDate: string,
): Promise<void> {
  await gql(
    request,
    `mutation CreateIncomeTransaction($input: CreateIncomeTransactionInput!) {
       createIncomeTransaction(input: $input) { id }
     }`,
    {
      input: {
        incomeSourceId: sourceId,
        accountId,
        amount,
        accountAmount: amount,
        accountCurrency: 'USD',
        exchangeRate: 1.0,
        note,
        transactionDate,
      },
    },
    token,
  );
}

test(
  'cancelling a transaction resets the list and preserves remaining month headers',
  async ({ page, request }) => {
    // ── Step 1: authenticate ─────────────────────────────────────────────────
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/$/);

    const token = await getAuthToken(request);

    // ── Step 2: create a fresh isolated account (zero starting balance) ───────
    const suffix = Date.now().toString();
    const account = await createFreshAccount(request, token, suffix);
    expect(account.id).toBeTruthy();

    // ── Step 3: ensure an income source exists ────────────────────────────────
    const source = await ensureIncomeSource(request, token);

    // ── Step 4: create 2 May transactions and 1 April transaction ─────────────
    // May 15 — this is the one we will cancel
    const noteMay15 = `pw-may15-${suffix}`;
    // May 10 — must survive after the cancellation
    const noteMay10 = `pw-may10-${suffix}`;
    // April 20 — must survive and keep the April month header
    const noteApr20 = `pw-apr20-${suffix}`;

    await createDatedIncomeTransaction(request, token, source.id, account.id, 150, noteMay15, '2026-05-15');
    await createDatedIncomeTransaction(request, token, source.id, account.id, 120, noteMay10, '2026-05-10');
    await createDatedIncomeTransaction(request, token, source.id, account.id, 200, noteApr20, '2026-04-20');

    // ── Step 5: navigate to the account detail page ───────────────────────────
    await page.goto(`/accounts/${account.id}`);
    await page.waitForLoadState('networkidle');

    const accountNameEl = page.getByText(account.name, { exact: true }).first();
    await expect(accountNameEl).toBeVisible({ timeout: 10_000 });

    // ── Step 6: confirm all three transaction rows are visible ────────────────
    const rowMay15 = page.locator('[role="button"]').filter({ hasText: noteMay15 }).first();
    const rowMay10 = page.locator('[role="button"]').filter({ hasText: noteMay10 }).first();
    const rowApr20 = page.locator('[role="button"]').filter({ hasText: noteApr20 }).first();

    await expect(rowMay15).toBeVisible({ timeout: 10_000 });
    await expect(rowMay10).toBeVisible({ timeout: 10_000 });
    await expect(rowApr20).toBeVisible({ timeout: 10_000 });

    // ── Step 7: confirm exactly 2 month headers before cancellation ───────────
    const monthHeaders = page.locator('div[style*="text-transform: uppercase"]');
    await expect(monthHeaders).toHaveCount(2, { timeout: 10_000 });

    const headerBefore0 = monthHeaders.nth(0);
    const headerBefore1 = monthHeaders.nth(1);
    await expect(headerBefore0).toContainText(YEAR_STRING);
    await expect(headerBefore1).toContainText(YEAR_STRING);

    // The two header labels must be distinct (May vs April)
    const label0Before = (await headerBefore0.textContent())?.trim() ?? '';
    const label1Before = (await headerBefore1.textContent())?.trim() ?? '';
    expect(label0Before).not.toBe(label1Before);

    // ── Step 8: cancel the May 15 transaction ─────────────────────────────────
    await rowMay15.click();
    await page.getByRole('button', { name: 'Delete' }).click();

    // Confirm the cancellation dialog is shown
    const dialogTitle = page.locator('h3', { hasText: 'Cancel transaction?' });
    await expect(dialogTitle).toBeVisible({ timeout: 5_000 });

    // Click the confirm button
    await page.getByRole('button', { name: 'Cancel transaction' }).click();

    // Wait for the modal to close
    await expect(dialogTitle).not.toBeVisible({ timeout: 10_000 });

    // ── Step 9: verify the cancelled row is gone ──────────────────────────────
    await expect(rowMay15).not.toBeVisible({ timeout: 15_000 });

    // ── Step 10: verify the surviving rows are still present ──────────────────
    await expect(rowMay10).toBeVisible({ timeout: 10_000 });
    await expect(rowApr20).toBeVisible({ timeout: 10_000 });

    // ── Step 11: both month headers must still be present ─────────────────────
    // May still has one transaction (May 10), so the May header must remain.
    // April still has its one transaction (Apr 20), so the April header must remain.
    await expect(monthHeaders).toHaveCount(2, { timeout: 10_000 });

    const headerAfter0 = monthHeaders.nth(0);
    const headerAfter1 = monthHeaders.nth(1);
    await expect(headerAfter0).toContainText(YEAR_STRING);
    await expect(headerAfter1).toContainText(YEAR_STRING);

    // The two surviving headers are still for different months
    const label0After = (await headerAfter0.textContent())?.trim() ?? '';
    const label1After = (await headerAfter1.textContent())?.trim() ?? '';
    expect(label0After).not.toBe(label1After);

    // ── Step 12: layout order — May header above April header ─────────────────
    const box0 = await headerAfter0.boundingBox();
    const box1 = await headerAfter1.boundingBox();
    expect(box0).not.toBeNull();
    expect(box1).not.toBeNull();
    // Most-recent month first (May above April)
    expect(box0!.y).toBeLessThan(box1!.y);
  },
);
