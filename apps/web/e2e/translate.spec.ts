import { expect, test } from '@playwright/test'
import { enterSourceText } from './helpers/enter-source-text'
import { mockTranslateApi } from './helpers/mock-translate'

test.describe('translate flow (mocked)', () => {
  test.beforeEach(async ({ page }) => {
    await mockTranslateApi(page)
    await page.goto('/')
  })

  test('translates English and shows result + play controls', async ({ page }) => {
    await enterSourceText(page)
    await page.getByRole('button', { name: 'Translate' }).click()

    await expect(page.getByTestId('result-translation')).toHaveText('你好，很高兴认识你。')
    await expect(page.getByRole('button', { name: 'Play Mainland' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Play Taiwan' })).toBeEnabled()
    await expect(page.getByText('to know (a person)')).toBeVisible()
  })

  test('toggles traditional characters', async ({ page }) => {
    await enterSourceText(page)
    await page.getByRole('button', { name: 'Translate' }).click()
    await expect(page.getByTestId('result-translation')).toHaveText('你好，很高兴认识你。')

    await page.getByRole('radio', { name: '繁體' }).click()
    await expect(page.getByTestId('result-translation')).toHaveText('你好，很高興認識你。')
  })
})
