import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import { loginAsTestUser } from './auth.setup';
import { gql, getAuthToken, ensureIncomeSource } from './helpers';

const GQL_ENDPOINT = 'http://localhost:8001/graphql';

/**
 * Creates a fresh isolated account with zero starting balance.
 * No "Initial balance" transaction is injected.
 */
async function createFreshAccount(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  suffix: string,
): Promise<{ id: string; name: string }> {
  const name = `PW Scroll ${suffix}`;
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
 * Inserts `count` income transactions for `accountId` / `userId` directly
 * into the transactions DB via psql + generate_series.  Each row gets a
 * distinct note ("Scroll test <i>") and date within May 2026.
 */
function bulkInsertTransactions(accountId: string, userId: string, count: number): void {
  const sql = `
    INSERT INTO transactions
      (user_id, type, amount, account_id, note, account_currency, account_amount, exchange_rate, transaction_date)
    SELECT
      '${userId}',
      'income',
      10.00,
      '${accountId}',
      'Scroll test ' || i,
      'USD',
      10.00,
      1.0,
      ('2026-05-' || LPAD(((i - 1) % 28 + 1)::text, 2, '0'))::date
    FROM generate_series(1, ${count}) AS s(i);
  `.replace(/\n\s+/g, ' ').trim();

  execSync(
    `docker compose exec -T transactions-db psql -U coinyan -d transactions_db -c "${sql}"`,
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
}

/**
 * Decode the JWT payload to extract the user_id / sub claim.
 */
function getUserIdFromToken(token: string): string {
  const payload = Buffer.from(token.split('.')[1], 'base64url').toString('utf8');
  const claims = JSON.parse(payload) as Record<string, unknown>;
  // BFF may encode it as "sub" or "user_id"
  const id = claims['sub'] ?? claims['user_id'] ?? claims['id'];
  if (!id) throw new Error(`Could not find user id in JWT payload: ${JSON.stringify(claims)}`);
  return String(id);
}

// ---------------------------------------------------------------------------
// Test 1: No spinner for ≤50 transactions
// ---------------------------------------------------------------------------
test(
  'no infinite-scroll spinner appears when account has ≤50 transactions',
  async ({ page, request }) => {
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/$/);

    const token = await getAuthToken(request);
    const suffix = `ns-${Date.now()}`;
    const account = await createFreshAccount(request, token, suffix);
    const source = await ensureIncomeSource(request, token);

    // Create exactly 3 transactions — well within the 50-item first page.
    for (let i = 1; i <= 3; i++) {
      await gql(
        request,
        `mutation CreateIncomeTransaction($input: CreateIncomeTransactionInput!) {
           createIncomeTransaction(input: $input) { id }
         }`,
        {
          input: {
            incomeSourceId: source.id,
            accountId: account.id,
            amount: 10,
            accountAmount: 10,
            accountCurrency: 'USD',
            exchangeRate: 1.0,
            note: `pw-nospinner-${i}-${suffix}`,
            transactionDate: '2026-05-20',
          },
        },
        token,
      );
    }

    await page.goto(`/accounts/${account.id}`);
    await page.waitForLoadState('networkidle');

    // Confirm page loaded
    await expect(page.getByText(account.name, { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    });

    // Wait for at least 1 transaction row to appear, ensuring the list is rendered.
    await expect(
      page.locator('[role="button"]').filter({ hasText: `pw-nospinner-1-${suffix}` }).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Scroll to the bottom to trigger IntersectionObserver
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);

    // The "Loading..." sentinel must NOT be present — there are no more pages.
    const loadingIndicator = page.locator(
      'div[style*="text-align: center"]',
      { hasText: 'Loading...' },
    );
    await expect(loadingIndicator).not.toBeVisible();
  },
);

// ---------------------------------------------------------------------------
// Test 2: Infinite scroll loads more transactions when account has >50
// ---------------------------------------------------------------------------
test(
  'infinite scroll loads more transactions when account has >50 transactions',
  async ({ page, request }) => {
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/$/);

    const token = await getAuthToken(request);
    const suffix = `is-${Date.now()}`;
    const account = await createFreshAccount(request, token, suffix);

    // Derive the user id from the JWT so we can do a direct DB insert.
    const userId = getUserIdFromToken(token);

    // Bulk-insert 55 income rows directly into the DB — much faster than
    // making 55 sequential GraphQL mutations.
    bulkInsertTransactions(account.id, userId, 55);

    // Navigate to the account detail page.
    await page.goto(`/accounts/${account.id}`);
    await page.waitForLoadState('networkidle');

    // Confirm we landed on the right page.
    await expect(page.getByText(account.name, { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    });

    // Wait until the first page (≤50 rows) is rendered.
    await expect(page.locator('[role="button"]').first()).toBeVisible({ timeout: 10_000 });

    const countBefore = await page.locator('[role="button"]').count();
    // The first page should show 50 rows (the LIMIT).
    expect(countBefore).toBe(50);

    // Scroll to the bottom to trigger the IntersectionObserver sentinel.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    // After the second page loads, the total count must exceed 50.
    const countAfter = await page.locator('[role="button"]').count();
    expect(countAfter).toBeGreaterThan(50);
  },
);
