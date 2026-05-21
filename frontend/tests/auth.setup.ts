import { type Page } from '@playwright/test';

const TEST_EMAIL = 'playwright@test.com';
const TEST_PASSWORD = 'Test1234!';
const TEST_NAME = 'Playwright Test';

/**
 * Sign in or sign up the test user via the UI.
 *
 * Strategy:
 * 1. Try to sign up. If it succeeds we land on `/` and we're done.
 * 2. If sign-up shows an error (user already exists) navigate to `/sign-in`
 *    and log in with the same credentials.
 */
export async function loginAsTestUser(page: Page): Promise<void> {
  // ---- attempt sign-up first ----
  await page.goto('/sign-up');
  await page.waitForLoadState('networkidle');

  await page.fill('#signup-name', TEST_NAME);
  await page.fill('#signup-email', TEST_EMAIL);
  await page.fill('#signup-password', TEST_PASSWORD);
  // blur so the password-requirements checker runs, then fill confirm
  await page.keyboard.press('Tab');
  await page.fill('#signup-confirm', TEST_PASSWORD);

  await page.click('button[type="submit"]');

  // Give React a moment to mutate
  await page.waitForTimeout(1500);

  // If we're already on home, sign-up succeeded — done
  if (page.url().endsWith('/') || page.url().endsWith('localhost:5173/')) {
    return;
  }

  // ---- fall back to sign-in ----
  await page.goto('/sign-in');
  await page.waitForLoadState('networkidle');

  await page.fill('#signin-email', TEST_EMAIL);
  await page.fill('#signin-password', TEST_PASSWORD);
  await page.click('button[type="submit"]');

  // Wait for redirect to home
  await page.waitForURL('**/');
}
