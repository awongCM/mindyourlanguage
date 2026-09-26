import { expect, test } from '@playwright/test'
import { enterSourceText, SAMPLE_TEXT } from './helpers/enter-source-text'
import { mockTranslateApi } from './helpers/mock-translate'

const syncedPhrasebookEntry = {
  id: 'pb-sync-1',
  translationId: null,
  sourceText: SAMPLE_TEXT,
  sourceLang: 'en',
  targetLang: 'zh',
  translation: '你好，很高兴认识你。',
  characterSet: 'simplified',
  dictionaryMatches: [],
  segments: [],
  tags: [],
  notes: '',
  createdAt: '2026-01-01T00:00:00.000Z',
}

test.describe('auth and cloud sync (mocked)', () => {
  test('shows sign-in when session is logged out', async ({ page }) => {
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      })
    })

    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
  })

  test('syncs phrasebook after mocked login', async ({ page }) => {
    let loggedIn = false

    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          loggedIn
            ? {
                user: {
                  id: 'user-e2e-1',
                  email: 'learner@example.com',
                  name: 'Learner',
                },
              }
            : {},
        ),
      })
    })

    await page.route('**/api/history**', async (route) => {
      const method = route.request().method()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      })
      void method
    })

    await page.route('**/api/phrasebook**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [syncedPhrasebookEntry] }),
      })
    })

    await page.route('**/api/review-events**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ events: [] }),
      })
    })

    await mockTranslateApi(page)
    await page.goto('/')
    loggedIn = true
    await page.reload()

    await enterSourceText(page)
    await page.getByRole('button', { name: 'Translate' }).click()
    await expect(page.getByTestId('result-translation')).toBeVisible()
    await page.getByRole('button', { name: 'Save to phrasebook' }).click()

    await page.getByRole('button', { name: 'Sync now' }).click()

    await page.reload()
    await page.getByRole('button', { name: 'Phrasebook' }).click()
    const drawer = page.getByRole('dialog')
    await expect(drawer.getByText(SAMPLE_TEXT)).toBeVisible()
    await expect(drawer.getByText('你好，很高兴认识你。')).toBeVisible()
  })
})
