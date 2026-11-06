import type { Page } from '@playwright/test'
import fixture from '../fixtures/translate-response.json'
import { mockLearnablesApi } from './mock-learnables'

export async function mockTranslateApi(page: Page) {
  await mockLearnablesApi(page, { items: [] })
  await page.route('**/api/translate', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixture),
    })
  })
}
