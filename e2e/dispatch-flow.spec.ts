import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers/auth'

/**
 * E2E: Dispatch workflow.
 *
 * Verifies the orders page loads with creation UI, the order creation wizard
 * has the 3-step flow (Vehicle -> Location -> Pricing), the dispatch board
 * renders with status-grouped sections, and the "New Trip" dialog opens.
 *
 * Note: Full data creation requires an authenticated session with a seeded
 * database. These tests verify UI structure and interactivity.
 */

test.describe('Orders page', () => {
  test('loads orders page with New Order button', async ({ page }) => {
    await loginAsTestUser(page)

    await page.goto('/orders')
    await page.waitForURL('**/orders')

    // Page header
    await expect(page.getByRole('heading', { name: /orders/i })).toBeVisible()

    // New Order button should be visible
    await expect(page.getByRole('button', { name: /new order/i })).toBeVisible()
  })

  test('opens order creation drawer with 3-step wizard', async ({ page }) => {
    await loginAsTestUser(page)

    await page.goto('/orders')

    // Click New Order to open the drawer
    await page.getByRole('button', { name: /new order/i }).click()

    // Drawer should show the step indicator with 3 steps
    await expect(page.getByText('Vehicle')).toBeVisible()
    await expect(page.getByText('Location')).toBeVisible()
    await expect(page.getByText('Pricing')).toBeVisible()

    // Step 1: Vehicle fields should be visible
    await expect(page.getByText(/new order/i)).toBeVisible()

    // Next and Cancel buttons
    await expect(page.getByRole('button', { name: /next/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible()
  })

  test('navigates through order wizard steps', async ({ page }) => {
    await loginAsTestUser(page)

    await page.goto('/orders')
    await page.getByRole('button', { name: /new order/i }).click()

    // Step 1 - Vehicle: fill minimal fields and advance
    // VIN field
    const vinInput = page.locator('input[name="vehicleVin"]')
    if (await vinInput.isVisible()) {
      await vinInput.fill('1HGBH41JXMN109186')
    }

    // Fill year, make, model
    const yearInput = page.locator('input[name="vehicleYear"]')
    if (await yearInput.isVisible()) {
      await yearInput.fill('2024')
    }

    const makeInput = page.locator('input[name="vehicleMake"]')
    if (await makeInput.isVisible()) {
      await makeInput.fill('Honda')
    }

    const modelInput = page.locator('input[name="vehicleModel"]')
    if (await modelInput.isVisible()) {
      await modelInput.fill('Civic')
    }

    // Click Next to go to Step 2
    await page.getByRole('button', { name: /next/i }).click()

    // Step 2 should show Location fields - back button appears
    await expect(page.getByRole('button', { name: /back/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /next/i })).toBeVisible()
  })
})

test.describe('Dispatch board', () => {
  test('loads dispatch page with trip sections', async ({ page }) => {
    await loginAsTestUser(page)

    await page.goto('/dispatch')
    await page.waitForURL('**/dispatch')

    // Page header
    await expect(page.getByRole('heading', { name: /dispatch board/i })).toBeVisible()

    // New Trip button
    await expect(page.getByRole('button', { name: /new trip/i })).toBeVisible()

    // Status sections should be visible (grouped by trip status)
    // At minimum, the Planned and In Progress sections are visible
    await expect(page.getByText('Planned')).toBeVisible()
    await expect(page.getByText('In Progress')).toBeVisible()
  })

  test('opens New Trip dialog', async ({ page }) => {
    await loginAsTestUser(page)

    await page.goto('/dispatch')

    // Open the New Trip dialog
    await page.getByRole('button', { name: /new trip/i }).click()

    // Dialog should appear with form fields
    await expect(page.getByRole('heading', { name: /create new trip/i })).toBeVisible()

    // Form fields: truck combobox, driver combobox, date inputs
    await expect(page.getByText('Truck')).toBeVisible()
    await expect(page.getByText('Driver')).toBeVisible()
    await expect(page.getByLabel(/start date/i)).toBeVisible()
    await expect(page.getByLabel(/end date/i)).toBeVisible()

    // Submit and cancel buttons
    await expect(page.getByRole('button', { name: /create trip/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible()
  })
})
