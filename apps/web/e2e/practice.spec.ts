import { expect, test } from '@playwright/test'
import { enterSourceText } from './helpers/enter-source-text'
import { mockTranslateApi } from './helpers/mock-translate'

test.describe('practice flows (mocked)', () => {
  test.beforeEach(async ({ page }) => {
    await mockTranslateApi(page)
    await page.goto('/')
  })

  test('try first shows comparison after translate', async ({ page }) => {
    await page.getByTestId('try-first-toggle').check()
    await page.getByTestId('user-attempt').fill('你好高兴认识你')
    await enterSourceText(page)
    await page.getByRole('button', { name: 'Translate' }).click()
    await expect(page.getByTestId('result-translation')).toBeVisible()
    await expect(page.getByTestId('comparison-panel')).toBeVisible()
    await expect(page.getByTestId('spoken-pinyin')).toBeVisible()
    await expect(
      page.getByTestId('comparison-panel').getByTestId('shadowing-player'),
    ).toBeVisible()
  })

  test('practice page drills a saved phrasebook entry', async ({ page }) => {
    await enterSourceText(page)
    await page.getByRole('button', { name: 'Translate' }).click()
    await expect(page.getByTestId('result-translation')).toBeVisible()
    await page.getByRole('button', { name: 'Save to phrasebook' }).click()

    await page.getByRole('link', { name: 'Practice' }).click()
    await expect(page).toHaveURL(/\/practice/)
    await expect(page.getByTestId('practice-drill-card')).toBeVisible()
    await expect(page.getByTestId('reliability-needle')).toBeVisible()
    await page.getByTestId('drill-reveal').click()
    await expect(page.getByTestId('drill-answer')).toBeVisible()
    await page.getByTestId('grade-good').click()
    await expect(page.getByTestId('reliability-needle')).toBeVisible()
    await expect(
      page.getByText('Practice a few due phrases to unlock your needle.'),
    ).toHaveCount(0)
    await expect(page.getByText('Based on self-grades')).toBeVisible()
  })
})
