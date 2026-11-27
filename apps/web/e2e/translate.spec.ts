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
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled()
    await expect(page.getByTestId('playback-speed-trigger')).toBeEnabled()

    const dictionaryTab = page.getByTestId('study-tab-dictionary')
    if (await dictionaryTab.isVisible()) await dictionaryTab.click()
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
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled()
    await expect(page.getByTestId('playback-speed-trigger')).toBeEnabled()
  })

  test('offers playback speed options in a dropdown', async ({ page }) => {
    await enterSourceText(page)
    await page.getByRole('button', { name: 'Translate' }).click()
    await expect(page.getByTestId('result-translation')).toHaveText('你好，很高兴认识你。')

    const trigger = page.getByTestId('playback-speed-trigger')
    await expect(trigger).toHaveText(/0\.75×/)
    await trigger.click()
    await expect(page.getByRole('menuitem', { name: 'Play at 0.5 speed' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Play at 0.75 speed' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Play at 1 speed' })).toBeVisible()
    await page.getByRole('menuitem', { name: 'Play at 0.5 speed' }).click()
    await expect(trigger).toHaveText(/0\.5×/)
  })

  test('switches between translation and native alternative registers', async ({ page }) => {
    await enterSourceText(page)
    await page.getByRole('button', { name: 'Translate' }).click()
    await expect(page.getByTestId('result-translation')).toHaveText('你好，很高兴认识你。')

    await page.getByTestId('native-register-tab').click()
    await expect(page.getByTestId('native-panel')).toContainText('你好，幸会。')
    await expect(page.getByTestId('native-panel')).toContainText('More concise greeting.')
  })
})
