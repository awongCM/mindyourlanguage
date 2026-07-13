const DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate'

const LANG_MAP = { en: 'EN', zh: 'ZH' } as const

export async function translateText(
  text: string,
  sourceLang: 'en' | 'zh',
  targetLang: 'en' | 'zh',
): Promise<{ text: string; detectedLang: 'en' | 'zh' }> {
  const params = new URLSearchParams({
    text,
    source_lang: LANG_MAP[sourceLang],
    target_lang: LANG_MAP[targetLang],
  })
  const res = await fetch(DEEPL_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })
  if (!res.ok) throw new Error(`DeepL error: ${res.status}`)
  const data = await res.json()
  return {
    text: data.translations[0].text,
    detectedLang: sourceLang,
  }
}
