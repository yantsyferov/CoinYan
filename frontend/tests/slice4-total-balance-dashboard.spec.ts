/**
 * Slice 4 verification: Total Balance tile + per-account base-currency labels
 *
 * Acceptance criteria:
 * 1. USD-base user with a EUR account and a USD account:
 *    - EUR account circle shows a secondary "≈ $X" / "≈ ... USD" label.
 *    - USD account circle does NOT show a secondary label.
 *    - Dashboard "Total Balance" tile shows a value in USD ($ symbol).
 * 2. After changing base currency to GBP via Profile:
 *    - EUR account circle now shows "≈ ...GBP" (£ symbol) secondary label.
 *    - Total Balance tile switches to GBP symbol.
 *
 * Note: UAH rates are unavailable in the rates-service; EUR/GBP/USD rates are present.
 */

import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { gql, parseCurrencyText } from './helpers';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMAIL = `playwright-s4-${Date.now()}@test.com`;
const PASSWORD = 'Test1234!';
const NAME = 'PW Slice4 User';

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function apiSignUp(
  request: APIRequestContext,
  email: string,
  password: string,
  name: string,
  baseCurrency: string,
): Promise<string> {
  const data = await gql<{ signUp: { accessToken: string } }>(
    request,
    `mutation SignUp($input: SignUpInput!) { signUp(input: $input) { accessToken } }`,
    { input: { displayName: name, email, password, baseCurrency } },
  );
  return data.signUp.accessToken;
}

async function ensureAccountByCurrency(
  request: APIRequestContext,
  token: string,
  currency: string,
  name: string,
): Promise<string> {
  type Acct = { id: string; currency: string; status: string };
  const data = await gql<{ accounts: Acct[] }>(
    request,
    '{ accounts { id currency status } }',
    undefined,
    token,
  );
  const match = data.accounts.find((a) => a.currency === currency && a.status === 'active');
  if (match) return match.id;

  const created = await gql<{ createAccount: Acct }>(
    request,
    `mutation CreateAccount($input: CreateAccountInput!) {
       createAccount(input: $input) { id currency status }
     }`,
    { input: { name, icon: 'cash', currency, startingBalance: 500 } },
    token,
  );
  return created.createAccount.id;
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

async function loginViaUI(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/sign-in');
  await page.waitForLoadState('networkidle');
  await page.fill('#signin-email', email);
  await page.fill('#signin-password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/', { timeout: 15_000 });
}

async function gotoHomeAndWait(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // Wait for the Accounts section heading to confirm page is fully rendered
  await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible({ timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Slice 4: Total Balance tile and per-account base-currency labels', () => {
  /**
   * We sign up a fresh user for each test run to avoid state pollution.
   * Both tests in this suite share the same user/accounts, so we create them
   * once at the describe level via a beforeAll-style setup inside the first test,
   * and stash the token in a module-level variable.
   */

  let token: string = '';

  // Scenario 1: USD-base user ──────────────────────────────────────────────

  test('Scenario 1: EUR account circle shows ≈ label; USD circle does not; Total Balance shows $', async ({
    page,
    request,
  }) => {
    // Create a fresh USD-base user for this test run
    token = await apiSignUp(request, EMAIL, PASSWORD, NAME, 'USD');

    // Create a EUR account (non-base currency → should show ≈ label; EUR/USD rate is available)
    await ensureAccountByCurrency(request, token, 'EUR', 'PW EUR Account');
    // Create a USD account (same as base currency → should NOT show ≈ label)
    await ensureAccountByCurrency(request, token, 'USD', 'PW USD Account');

    // Log in and navigate to home page
    await loginViaUI(page, EMAIL, PASSWORD);
    await gotoHomeAndWait(page);

    // ── EUR account circle: must have a secondary ≈ label ──
    // The secondary label is rendered as a <span> immediately after the
    // DraggableAccountItem wrapping div, with text starting with "≈ ".
    const eurLabel = page.locator('span').filter({ hasText: /^≈/ }).first();
    await expect(eurLabel).toBeVisible({ timeout: 10_000 });
    const eurLabelText = await eurLabel.textContent();
    expect(eurLabelText).toMatch(/≈/);
    // The label should show USD (dollar symbol or "USD") since base is USD
    expect(eurLabelText).toMatch(/\$|USD/);

    // ── USD account circle: must NOT have a secondary ≈ label adjacent to it ──
    // Strategy: count total ≈ spans. Since we only have one foreign-currency
    // account (EUR) and one same-currency account (USD), there should be exactly
    // one ≈ label on the page.
    const allApproxLabels = page.locator('span').filter({ hasText: /^≈/ });
    await expect(allApproxLabels).toHaveCount(1, { timeout: 10_000 });

    // ── Dashboard Total Balance tile shows $ symbol ──
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const totalBalanceLabelSpan = page.locator('span', { hasText: 'Total Balance' }).first();
    await expect(totalBalanceLabelSpan).toBeVisible({ timeout: 10_000 });
    // Get the sibling value span (the parent contains [label, value])
    const totalBalanceValue = await totalBalanceLabelSpan
      .locator('..')
      .locator('span')
      .last()
      .textContent();
    expect(totalBalanceValue).toMatch(/\$/);
    // Value must be parseable as a number
    const numericValue = parseCurrencyText(totalBalanceValue);
    expect(numericValue).toBeGreaterThanOrEqual(0);
  });

  // Scenario 2: Change base currency to EUR ──────────────────────────────

  test('Scenario 2: after changing base currency to GBP, EUR circle label shows £', async ({
    page,
    request,
  }) => {
    // Sign in as the same user created in Scenario 1 (EMAIL/PASSWORD)
    // If token is still empty (tests ran in isolation), sign up again
    if (!token) {
      token = await apiSignUp(request, EMAIL, PASSWORD, NAME, 'USD').catch(async () => {
        // User may already exist — sign in instead
        const data = await gql<{ signIn: { accessToken: string } }>(
          request,
          `mutation { signIn(input: { email: "${EMAIL}", password: "${PASSWORD}" }) { accessToken } }`,
        );
        return data.signIn.accessToken;
      });
      await ensureAccountByCurrency(request, token, 'EUR', 'PW EUR Account');
      await ensureAccountByCurrency(request, token, 'USD', 'PW USD Account');
    }

    await loginViaUI(page, EMAIL, PASSWORD);

    // Navigate to Profile and change base currency from USD → GBP
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    // Find the "Base Currency" card and click Edit
    const baseCurrencySection = page.locator('h2', { hasText: 'Base Currency' }).first();
    await expect(baseCurrencySection).toBeVisible({ timeout: 10_000 });
    const editBtn = baseCurrencySection
      .locator('..')
      .locator('button', { hasText: 'Edit' })
      .first();
    await editBtn.click();

    // The CurrencyPicker should now be visible — select GBP
    const currencySelect = page.locator('select').first();
    await expect(currencySelect).toBeVisible({ timeout: 5_000 });
    await currencySelect.selectOption('GBP');

    // Click Save
    const saveBtn = baseCurrencySection
      .locator('..')
      .locator('button', { hasText: 'Save' })
      .first();
    await saveBtn.click();

    // Wait briefly for the mutation to complete and UI to revert to view mode
    await page.waitForTimeout(1_500);

    // Navigate back to home page
    await gotoHomeAndWait(page);

    // ── EUR account circle: label should now show £ or GBP ──
    const eurLabel = page.locator('span').filter({ hasText: /^≈/ }).first();
    await expect(eurLabel).toBeVisible({ timeout: 10_000 });
    const eurLabelText = await eurLabel.textContent();
    expect(eurLabelText).toMatch(/£|GBP/);

    // ── Dashboard Total Balance tile should now show £ or GBP ──
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const totalBalanceLabelSpan = page.locator('span', { hasText: 'Total Balance' }).first();
    await expect(totalBalanceLabelSpan).toBeVisible({ timeout: 10_000 });
    const totalBalanceValue = await totalBalanceLabelSpan
      .locator('..')
      .locator('span')
      .last()
      .textContent();
    expect(totalBalanceValue).toMatch(/£|GBP/);
  });
});
