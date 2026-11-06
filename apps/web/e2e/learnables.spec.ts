import { expect, test } from '@playwright/test'
import { enterSourceText } from './helpers/enter-source-text'
import { mockLearnablesApi } from './helpers/mock-learnables'
import { mockTranslateApi } from './helpers/mock-translate'

test.describe('learnable suggestions (mocked)', () => {
  test.beforeEach(async ({ page }) => {
    await mockTranslateApi(page)
    await mockLearnablesApi(page)
    await page.goto('/')
  })

  test('shows new bits and saves selected to phrasebook', async ({ page }) => {
    await enterSourceText(page)
    await page.getByRole('button', { name: 'Translate' }).click()

    const suggestions = page.getByTestId('learnable-suggestions')
    await expect(suggestions).toBeVisible()
    await expect(suggestions.getByText('认识', { exact: true })).toBeVisible()
    await expect(suggestions.getByText('to get to know')).toBeVisible()
    await expect(
      page.getByText('Or pick a few new bits to learn below.'),
    ).toBeVisible()

    await page.getByTestId('save-selected-learnables').click()

    await page.getByRole('button', { name: 'Phrasebook', exact: true }).click()
    const drawer = page.getByRole('dialog')
    await expect(drawer.getByText('认识', { exact: true })).toBeVisible()
    await expect(drawer.getByText('to get to know')).toBeVisible()
    await expect(drawer.getByText('高兴', { exact: true })).toBeVisible()
  })
})
