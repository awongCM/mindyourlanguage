import { expect, test } from '@playwright/test'
import { enterSourceText } from './helpers/enter-source-text'
import { mockTranslateApi } from './helpers/mock-translate'

test.describe('practice layout (mocked)', () => {
  test.beforeEach(async ({ page }) => {
    await mockTranslateApi(page)
    await page.goto('/')
    await enterSourceText(page)
    await page.getByRole('button', { name: 'Translate' }).click()
    await expect(page.getByTestId('result-translation')).toBeVisible()
    await page.getByRole('button', { name: 'Save to phrasebook' }).click()
    await page.getByRole('link', { name: 'Practice' }).click()
    await expect(page).toHaveURL(/\/practice/)
  })

  // A fresh entry is due but not speed-eligible: speed unlocks after the first
  // recall, which also pushes the entry's next review out of "Due today".
  test('mode tabs render in spec order with counts', async ({ page }) => {
    const tabs = page.getByRole('tab')
    await expect(tabs.nth(0)).toHaveAttribute('data-testid', 'mode-speed')
    await expect(tabs.nth(1)).toHaveAttribute('data-testid', 'mode-due')
    await expect(tabs.nth(2)).toHaveAttribute('data-testid', 'mode-all')
    await expect(page.getByTestId('mode-speed')).toContainText('Speed (0)')
    await expect(page.getByTestId('mode-due')).toContainText('Due today (1)')
    await expect(page.getByTestId('mode-all')).toContainText('All saved (1)')
  })

  test('all mode lists the queue with a due pill and jumps on click', async ({
    page,
  }) => {
    await page.getByTestId('mode-all').click()
    await expect(page.getByTestId('practice-queue-list')).toBeVisible()
    await expect(page.getByTestId('queue-pill-due').first()).toHaveText(
      'Due today',
    )
    await expect(page.getByTestId('queue-pill-speed')).toHaveCount(0)
    await page.getByTestId('queue-row').first().click()
    await expect(page.getByTestId('practice-drill-card')).toBeVisible()
  })

  test('reviewed entry moves from due to speed ready in the queue list', async ({
    page,
  }) => {
    await page.getByTestId('drill-reveal').click()
    await page.getByTestId('grade-good').click()
    await expect(page.getByTestId('mode-speed')).toContainText('Speed (1)')
    await expect(page.getByTestId('mode-due')).toContainText('Due today (0)')
    await page.getByTestId('mode-all').click()
    await expect(page.getByTestId('queue-pill-speed').first()).toHaveText(
      'Speed ready',
    )
    await expect(page.getByTestId('queue-pill-due')).toHaveCount(0)
  })

  test('reliability panel shows stat tiles after a review', async ({ page }) => {
    await page.getByTestId('drill-reveal').click()
    await page.getByTestId('grade-good').click()
    await expect(page.getByTestId('stat-saved')).toContainText('1')
    await expect(page.getByTestId('stat-speed')).toBeVisible()
    await expect(page.getByTestId('stat-due')).toBeVisible()
    await expect(page.getByTestId('reliability-hero')).toBeVisible()
  })
})
