import { expect, type Page } from '@playwright/test'

export const SAMPLE_TEXT = 'Hello, nice to meet you.'

/** Fill a React-controlled textarea and wait until char count reflects the value. */
export async function enterSourceText(page: Page, text = SAMPLE_TEXT) {
  const textarea = page.getByPlaceholder('Enter text to translate…')
  await textarea.evaluate((el, value) => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value',
    )?.set
    setter?.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, text)
  await expect(page.getByText(`${text.length}/500`)).toBeVisible()
}
