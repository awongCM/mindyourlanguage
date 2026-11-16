import type { Page } from '@playwright/test'
import chunksFixture from '../fixtures/practice-chunks-response.json'
import longFixture from '../fixtures/long-translate-response.json'
import { mockLearnablesApi } from './mock-learnables'

export async function mockLongTranslateAndChunks(
  page: Page,
  chunksBody: object = chunksFixture,
) {
  await mockLearnablesApi(page, { items: [] })
  await page.route('**/api/practice-chunks', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(chunksBody),
    })
  })
  await page.route('**/api/translate', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(longFixture),
    })
  })
}