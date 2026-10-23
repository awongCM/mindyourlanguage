import { expect, test } from '@playwright/test'
import { enterSourceText } from './helpers/enter-source-text'
import { mockTranslateApi } from './helpers/mock-translate'

test.describe('practice flows (mocked)', () => {
  test.beforeEach(async ({ page }) => {
    await mockTranslateApi(page)
    await page.goto('/')
  })

  test('try first shows comparison after translate', async ({ page }) => {
    await page.getByTestId('try-first-toggle').check()
    await page.getByTestId('user-attempt').fill('你好高兴认识你')
    await enterSourceText(page)
    await page.getByRole('button', { name: 'Translate' }).click()
    await expect(page.getByTestId('result-translation')).toBeVisible()
    await expect(page.getByTestId('comparison-panel')).toBeVisible()
    await expect(page.getByTestId('spoken-pinyin')).toBeVisible()
    await expect(
      page.getByTestId('comparison-panel').getByTestId('shadowing-player'),
    ).toBeVisible()
  })

  test('practice page drills a saved phrasebook entry', async ({ page }) => {
    await enterSourceText(page)
    await page.getByRole('button', { name: 'Translate' }).click()
    await expect(page.getByTestId('result-translation')).toBeVisible()
    await page.getByRole('button', { name: 'Save to phrasebook' }).click()

    await page.getByRole('link', { name: 'Practice' }).click()
    await expect(page).toHaveURL(/\/practice/)
    await expect(page.getByTestId('practice-drill-card')).toBeVisible()
    await expect(page.getByTestId('reliability-needle')).toBeVisible()
    await page.getByTestId('drill-reveal').click()
    await expect(page.getByTestId('drill-answer')).toBeVisible()
    await page.getByTestId('grade-good').click()
    await expect(page.getByTestId('reliability-needle')).toBeVisible()
    await expect(page.getByTestId('reliability-hero')).toHaveText(
      'Building signal…',
    )
    await expect(
      page
        .getByTestId('reliability-needle')
        .locator('p.text-sm.text-muted-foreground'),
    ).toHaveText('1 of 1 reviews reliable · last 7 days')
    await expect(
      page.getByText('Practice a few due phrases to unlock your needle.'),
    ).toHaveCount(0)
  })

  test('speed mode accepts the saved phrase across three shrinking passes', async ({
    page,
  }) => {
    await enterSourceText(page)
    await page.getByRole('button', { name: 'Translate' }).click()
    await expect(page.getByTestId('result-translation')).toBeVisible()
    await page.getByRole('button', { name: 'Save to phrasebook' }).click()

    await page.getByRole('link', { name: 'Practice' }).click()
    await page.getByTestId('drill-reveal').click()
    await page.getByTestId('grade-good').click()

    await page.getByTestId('mode-speed').click()
    await expect(page.getByTestId('speed-drill-card')).toBeVisible()
    await expect(page.getByTestId('speed-pass')).toHaveText(/Pass 1 of 3/)

    for (const pass of [1, 2, 3]) {
      await page.getByTestId('speed-attempt').fill('你好很高兴认识你')
      await page.getByTestId('speed-check').click()
      if (pass < 3) {
        await expect(page.getByTestId('speed-pass')).toHaveText(
          new RegExp(`Pass ${pass + 1} of 3`),
        )
      }
    }

    await expect(page.getByTestId('speed-done')).toBeVisible()
    await expect(page.getByTestId('speed-done')).toContainText('Fast day saved')
    await expect(page.getByTestId('speed-status')).toContainText('1 of 3')
  })

  test('speed mode shows the saved phrase when the attempt does not match', async ({
    page,
  }) => {
    await enterSourceText(page)
    await page.getByRole('button', { name: 'Translate' }).click()
    await expect(page.getByTestId('result-translation')).toBeVisible()
    await page.getByRole('button', { name: 'Save to phrasebook' }).click()

    await page.getByRole('link', { name: 'Practice' }).click()
    await page.getByTestId('drill-reveal').click()
    await page.getByTestId('grade-good').click()
    await page.getByTestId('mode-speed').click()

    await page.getByTestId('speed-attempt').fill('再见')
    await page.getByTestId('speed-check').click()
    await expect(page.getByTestId('speed-miss')).toBeVisible()
    await expect(page.getByTestId('speed-miss')).toContainText('你好，很高兴认识你。')
    await expect(page.getByTestId('speed-status')).toContainText('No fast days yet')
  })
})
