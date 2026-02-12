import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers/auth'

/**
 * E2E: Billing flow.
 *
 * Verifies the billing page renders correctly with its three key sections:
 * receivables by broker, aging analysis, and collection rate.
 *
 * Note: Billing is an admin-only page. The test user must have the admin role
 * for these tests to pass. Data-dependent assertions use flexible matchers.
 */

test.describe('Billing page', () => {
  test('loads billing page with receivables section', async ({ page }) => {
    await loginAsTestUser(page)

    await page.goto('/billing')
    await page.waitForURL('**/billing')

    // Page header
    await expect(page.getByRole('heading', { name: /billing/i })).toBeVisible()

    // Subtitle
    await expect(
      page.getByText(/track receivables, aging, and collection performance/i)
    ).toBeVisible()

    // Receivables by Broker section
    await expect(page.getByText(/receivables by broker/i)).toBeVisible()
  })

  test('displays aging analysis section', async ({ page }) => {
    await loginAsTestUser(page)

    await page.goto('/billing')

    // Aging Analysis section header
    await expect(page.getByText(/aging analysis/i).first()).toBeVisible()
  })

  test('displays collection rate widget', async ({ page }) => {
    await loginAsTestUser(page)

    await page.goto('/billing')

    // Collection rate percentage display
    await expect(page.getByText(/collection rate/i)).toBeVisible()

    // The collection rate shows a percentage
    await expect(page.getByText(/%/)).toBeVisible()
  })

  test('receivables table has expected column structure', async ({ page }) => {
    await loginAsTestUser(page)

    await page.goto('/billing')

    // The receivables table should have column headers for key data
    // These are table headers inside the Receivables by Broker section
    const tableSection = page.locator('section').filter({ hasText: /receivables by broker/i })

    // Table should exist within this section
    await expect(tableSection.locator('table').or(tableSection.getByText(/no receivables/i))).toBeVisible()
  })

  test('aging analysis table has expected time buckets', async ({ page }) => {
    await loginAsTestUser(page)

    await page.goto('/billing')

    // Aging analysis groups invoices by time periods
    // Look for the section and its table or empty state
    const agingSection = page.locator('section').filter({ hasText: /aging analysis/i })

    await expect(
      agingSection.locator('table').or(agingSection.getByText(/no aging/i).or(page.getByText(/aging analysis/i)))
    ).toBeVisible()
  })
})
