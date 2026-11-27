import { expect, test } from '@playwright/test'

test.describe('app shell — desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('chip nav links to practice', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Practice' }).click()
    await expect(page).toHaveURL(/\/practice$/)
  })

  test('phrasebook chip opens the drawer', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Phrasebook' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('desktop /phrasebook redirects to the drawer', async ({ page }) => {
    await page.goto('/phrasebook')
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('dialog')).toBeVisible()
  })
})

test.describe('app shell — mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('bottom tab bar navigates to the saved screen', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Saved' }).click()
    await expect(page).toHaveURL(/\/phrasebook$/)
    await expect(page.getByText('Nothing saved yet')).toBeVisible()
  })

  test('switcher moves between phrasebook and history', async ({ page }) => {
    await page.goto('/phrasebook')
    await page.getByRole('tab', { name: /History/ }).click()
    await expect(page).toHaveURL(/\/history$/)
    await expect(page.getByText('No translations yet')).toBeVisible()
  })

  test('history screen restores onto the translate page', async ({ page }) => {
    await page.goto('/')
    // zustand persist default version is 0 (history store sets no `version`).
    await page.evaluate(() => {
      localStorage.setItem(
        'myl-history',
        JSON.stringify({
          state: {
            items: [
              {
                id: 'e2e-h1',
                userId: null,
                sourceText: 'hello world',
                sourceLang: 'en',
                targetLang: 'zh',
                translation: '你好世界',
                characterSet: 'simplified',
                dictionaryMatches: [],
                segments: [],
                createdAt: new Date().toISOString(),
              },
            ],
          },
          version: 0,
        }),
      )
    })
    await page.goto('/history')
    await page.getByRole('button', { name: 'Restore 你好世界' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByTestId('result-translation')).toContainText('你好世界')
  })
})
