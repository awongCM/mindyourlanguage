import type { Page } from '@playwright/test'

export async function mockTranslateZhEnApi(page: Page) {
  await page.route('**/api/translate', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback()
      return
    }

    const body = route.request().postDataJSON() as {
      text?: string
      sourceLang?: string
      targetLang?: string
    }

    if (body.sourceLang === 'zh' && body.targetLang === 'en') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'e2e-translate-zh-en-1',
          translation:
            'Liu Yingxuan has never heard of a blacklist of male actors.',
          detectedLang: 'zh',
          pinyin: 'liú yǐng xuán wèi tīng wén guó nán yì rén hēi míng dān',
          spokenPinyin: 'liú yǐng xuán wèi tīng wén guó nán yì rén hēi míng dān',
          traditional: '劉穎璇未聽聞「男藝人黑名單」',
          segments: [
            { text: '刘颖璇', pinyin: 'liú yǐng xuán' },
            { text: '未', pinyin: 'wèi' },
            { text: '听闻', pinyin: 'tīng wén' },
          ],
          dictionaryMatches: [
            {
              simplified: '听闻',
              traditional: '聽聞',
              pinyin: 'ting1 wen2',
              definitions: ['to hear of'],
            },
          ],
        }),
      })
      return
    }

    await route.fallback()
  })
}
