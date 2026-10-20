import { expect, test } from '@playwright/test'
import { enterSourceText, SAMPLE_TEXT } from './helpers/enter-source-text'
import { mockTranslateApi } from './helpers/mock-translate'

const TRANSLATION = '你好，很高兴认识你。'

const serverRecord = {
  id: 'server-history-1',
  userId: null,
  sourceText: SAMPLE_TEXT,
  sourceLang: 'en',
  targetLang: 'zh',
  translation: TRANSLATION,
  characterSet: 'simplified',
  dictionaryMatches: [],
  segments: [],
  createdAt: '2026-01-01T00:00:00.000Z',
}

test.describe('persistence across refresh (mocked)', () => {
  test('restores the latest translation after reload with browser storage only', async ({
    page,
  }) => {
    await mockTranslateApi(page)
    await page.goto('/')
    await enterSourceText(page)
    await page.getByRole('button', { name: 'Translate' }).click()
    await expect(page.getByTestId('result-translation')).toBeVisible()

    await page.reload()

    await expect(page.getByTestId('result-translation')).toHaveText(TRANSLATION)
    await expect(page.getByPlaceholder('Enter text to translate…')).toHaveValue(
      SAMPLE_TEXT,
    )
    await expect(page.getByText('Cloud sync failed')).toHaveCount(0)
  })

  test('shows the latest translation from the server on a fresh browser', async ({
    page,
  }) => {
    await page.route('**/api/history', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [serverRecord] }),
      }),
    )
    await page.route('**/api/phrasebook', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      }),
    )
    await page.route('**/api/review-events**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ events: [] }),
      }),
    )

    await page.goto('/')

    await expect(page.getByTestId('result-translation')).toHaveText(TRANSLATION)
    await expect(page.getByPlaceholder('Enter text to translate…')).toHaveValue(
      SAMPLE_TEXT,
    )
  })

  test('does not show a toast when a background sync fails', async ({ page }) => {
    await mockTranslateApi(page)
    await page.route('**/api/history', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [] }),
        })
      }
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Database error' }),
      })
    })
    await page.route('**/api/phrasebook', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      }),
    )
    await page.route('**/api/review-events**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ events: [] }),
      }),
    )

    const pulled = Promise.all(
      ['/api/history', '/api/phrasebook', '/api/review-events'].map((path) =>
        page.waitForResponse(
          (res) =>
            res.url().endsWith(path) && res.request().method() === 'GET',
        ),
      ),
    )
    await page.goto('/')
    await pulled

    const failedPush = page.waitForResponse(
      (res) =>
        res.url().endsWith('/api/history') && res.request().method() === 'PUT',
    )
    await enterSourceText(page)
    await page.getByRole('button', { name: 'Translate' }).click()
    await expect(page.getByTestId('result-translation')).toBeVisible()

    expect((await failedPush).status()).toBe(503)
    await page.waitForTimeout(500)
    await expect(page.getByText('Cloud sync failed')).toHaveCount(0)
  })
})
