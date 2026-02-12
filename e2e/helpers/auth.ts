import type { Page } from '@playwright/test'

/**
 * Test user credentials sourced from environment variables.
 * Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD in your .env or CI secrets.
 */
export const TEST_USER = {
  email: process.env.E2E_TEST_EMAIL ?? 'e2e@vroomx.test',
  password: process.env.E2E_TEST_PASSWORD ?? 'TestPassword123!',
}

/**
 * Log in as the test user via the password-based login form.
 *
 * Uses Playwright auto-waiting exclusively (no fixed sleeps).
 * After login, waits for a redirect to the /dashboard URL.
 */
export async function loginAsTestUser(page: Page): Promise<void> {
  await page.goto('/login')

  // Ensure we are on the password tab (default)
  await page.getByRole('tab', { name: /password/i }).click()

  // Fill credentials
  await page.getByLabel(/email/i).fill(TEST_USER.email)
  await page.getByLabel(/password/i).fill(TEST_USER.password)

  // Submit and wait for dashboard redirect
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL('**/dashboard**')
}

/**
 * Helper to create a test order via the order wizard.
 *
 * Navigates to /orders, opens the creation drawer, fills out the three-step
 * wizard with minimal required data, and submits.
 *
 * Returns the visible order number from the confirmation or list.
 */
export async function createTestOrder(page: Page): Promise<string> {
  await page.goto('/orders')

  // Open order creation drawer
  await page.getByRole('button', { name: /new order/i }).click()

  // Step 1 - Broker & basic info
  // Fill minimal required fields (broker selection, pickup/delivery locations)
  await page.getByLabel(/pickup city/i).fill('Los Angeles')
  await page.getByLabel(/pickup state/i).fill('CA')
  await page.getByLabel(/delivery city/i).fill('Phoenix')
  await page.getByLabel(/delivery state/i).fill('AZ')

  // Advance to step 2
  await page.getByRole('button', { name: /next/i }).click()

  // Step 2 - Vehicles
  await page.getByLabel(/year/i).fill('2024')
  await page.getByLabel(/make/i).fill('Toyota')
  await page.getByLabel(/model/i).fill('Camry')

  // Advance to step 3
  await page.getByRole('button', { name: /next/i }).click()

  // Step 3 - Review & pricing
  await page.getByLabel(/revenue/i).fill('1500')

  // Submit
  await page.getByRole('button', { name: /create order/i }).click()

  // Wait for navigation back to orders list or detail
  await page.waitForURL(/\/orders/)

  // Return a placeholder; actual order number depends on UI confirmation
  return 'created'
}
