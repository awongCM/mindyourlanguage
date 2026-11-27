import { expect, type Page } from '@playwright/test'

export const SAMPLE_TEXT = 'Hello, nice to meet you.'

/**
 * Fill the React-controlled source textarea and wait until the char count
 * reflects the value. Retries the fill so an input event dropped before React
 * hydration completes cannot leave the helper (and the spec) flaky.
 */
export async function enterSourceText(page: Page, text = SAMPLE_TEXT) {
  const textarea = page.getByPlaceholder('Enter text to translate…')
  await expect(textarea).toBeEditable()
  await expect(async () => {
    await textarea.fill(text)
    await expect(textarea).toHaveValue(text, { timeout: 1_000 })
    await expect(page.getByText(`${text.length}/1000`)).toBeVisible({
      timeout: 1_000,
    })
  }).toPass({ timeout: 15_000 })
}
