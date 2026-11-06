import type { Page } from '@playwright/test'

export const LEARNABLES_FIXTURE = {
  items: [
    {
      chinese: '认识',
      gloss: 'to get to know',
      kind: 'verb',
      exampleChinese: '很高兴认识你。',
      exampleEnglish: 'Nice to meet you.',
    },
    {
      chinese: '高兴',
      gloss: 'happy',
      kind: 'noun',
      exampleChinese: '我很高兴。',
      exampleEnglish: 'I am happy.',
    },
  ],
}

export async function mockLearnablesApi(
  page: Page,
  body: object = LEARNABLES_FIXTURE,
) {
  await page.route('**/api/learnables', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  })
}
