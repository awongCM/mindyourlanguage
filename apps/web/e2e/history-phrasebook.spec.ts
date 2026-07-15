import { expect, test } from '@playwright/test'
import { enterSourceText, SAMPLE_TEXT } from './helpers/enter-source-text'
import { mockTranslateApi } from './helpers/mock-translate'

test.describe('history and phrasebook (mocked)', () => {
  test.beforeEach(async ({ page }) => {
    await mockTranslateApi(page)
    await page.goto('/')
    await enterSourceText(page)
    await page.getByRole('button', { name: 'Translate' }).click()
    await expect(page.getByTestId('result-translation')).toBeVisible()
  })

  test('saves to history and restores', async ({ page }) => {
    await page.getByRole('button', { name: 'History' }).click()
    const drawer = page.getByRole('dialog')
    await expect(drawer.getByText(SAMPLE_TEXT)).toBeVisible()
    await drawer.getByText('你好，很高兴认识你。').first().click()
    await expect(page.getByTestId('result-translation')).toHaveText('你好，很高兴认识你。')
    await expect(page.getByPlaceholder('Enter text to translate…')).toHaveValue(
      SAMPLE_TEXT,
    )
  })

  test('saves to phrasebook and lists entry', async ({ page }) => {
    await page.getByRole('button', { name: 'Save to phrasebook' }).click()
    await page.getByRole('button', { name: 'Phrasebook' }).click()
    const drawer = page.getByRole('dialog')
    await expect(drawer.getByText(SAMPLE_TEXT)).toBeVisible()
    await expect(drawer.getByText('你好，很高兴认识你。')).toBeVisible()
  })
})
