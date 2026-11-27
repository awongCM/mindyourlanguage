import { expect, test } from '@playwright/test'
import { enterSourceText } from './helpers/enter-source-text'
import { mockTranslateApi } from './helpers/mock-translate'

test.describe('translate workspace (mocked)', () => {
  test.beforeEach(async ({ page }) => {
    await mockTranslateApi(page)
    await page.goto('/')
    await enterSourceText(page)
    await page.getByRole('button', { name: 'Translate' }).click()
    await expect(page.getByTestId('result-translation')).toBeVisible()
  })

  test('desktop shows the reading passage with a synced dictionary token', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await expect(page.getByTestId('reading-passage')).toBeVisible()

    const token = page.getByTestId('passage-token').first()
    await expect(token).toHaveAttribute('data-entry-key', '认识')
    await token.click()
    await expect(token).toHaveAttribute('aria-pressed', 'true')
    await expect(
      page.getByTestId('dictionary-card').first(),
    ).toHaveAttribute('data-active', 'true')
  })

  test('mobile hides the reading passage but keeps the study panel', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByTestId('reading-passage')).toBeHidden()
    await expect(page.getByTestId('study-panel')).toBeVisible()
    await expect(page.getByTestId('study-tab-dictionary')).toBeVisible()
  })

  test('pinyin toggle reveals the pinyin line', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.getByTestId('passage-pinyin-toggle').click()
    await expect(page.getByTestId('passage-pinyin')).toContainText('nǐ hǎo')
  })
})
