import { expect, test } from '@playwright/test'
import { enterSourceText } from './helpers/enter-source-text'
import { mockTranslateApi } from './helpers/mock-translate'
import { mockTranslateZhEnApi } from './helpers/mock-translate-zh-en'

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

  test('shows source pinyin for Chinese to English', async ({ page }) => {
    await mockTranslateZhEnApi(page)
    await page.getByRole('button', { name: 'Swap translation direction' }).click()
    await page
      .getByPlaceholder('Enter text to translate…')
      .fill('刘颖璇未听闻男艺人黑名单')
    await page.getByRole('button', { name: 'Translate' }).click()

    await expect(page.getByTestId('result-translation')).toContainText(
      'Liu Yingxuan',
    )
    await expect(page.getByTestId('source-chinese-block')).toBeVisible()
    await expect(page.getByTestId('source-chinese-text')).toContainText('刘颖璇')
    await expect(page.getByTestId('spoken-pinyin')).toBeVisible()
    await expect(page.getByText('to hear of')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Play Mainland' })).toBeEnabled()
  })
})
