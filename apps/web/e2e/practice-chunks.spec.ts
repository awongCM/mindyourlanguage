import { expect, test } from '@playwright/test'
import { enterSourceText } from './helpers/enter-source-text'
import { mockLongTranslateAndChunks } from './helpers/mock-practice-chunks'

const LONG_SOURCE =
  'When you learn a new language, practicing every day is very important. Phrases and sentences help you build fluency rather than memorizing whole paragraphs at once.'

type PhrasebookPersist = {
  state: { items: Array<{ id: string; parentId?: string; translation: string }> }
}

function readPhrasebook(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('myl-phrasebook')
    if (!raw) return []
    const parsed = JSON.parse(raw) as PhrasebookPersist
    return parsed.state?.items ?? []
  })
}

test.describe('practice chunks (spec goals, mocked APIs)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.removeItem('myl-phrasebook')
      localStorage.removeItem('myl-review-events')
    })
    await mockLongTranslateAndChunks(page)
  })

  test('suggests editable chunks after long EN→ZH translate', async ({ page }) => {
    await enterSourceText(page, LONG_SOURCE)
    await page.getByRole('button', { name: 'Translate' }).click()
    await expect(page.getByTestId('result-translation')).toBeVisible()
    await expect(page.getByTestId('practice-chunks')).toBeVisible()
    await expect(
      page.getByTestId('practice-chunks').getByText('Practice chunks'),
    ).toBeVisible()
    await expect(page.getByLabel('Practice chunk suggestions')).toBeVisible()
    await expect(page.getByTestId('learnable-suggestions')).toHaveCount(0)
  })

  test('save phrase + selected chunks creates parent and children', async ({
    page,
  }) => {
    await enterSourceText(page, LONG_SOURCE)
    await page.getByRole('button', { name: 'Translate' }).click()
    await expect(page.getByTestId('practice-chunks')).toBeVisible()
    await page.getByRole('button', { name: 'Save phrase + selected chunks' }).click()

    const items = await readPhrasebook(page)
    expect(items.length).toBeGreaterThanOrEqual(4)
    const parents = items.filter((item) => !item.parentId)
    const children = items.filter((item) => item.parentId)
    expect(parents).toHaveLength(1)
    expect(children.length).toBeGreaterThanOrEqual(3)
    expect(children.every((c) => c.parentId === parents[0]?.id)).toBe(true)
  })

  test('locked parent is hidden from Due; children drill normally', async ({
    page,
  }) => {
    await enterSourceText(page, LONG_SOURCE)
    await page.getByRole('button', { name: 'Translate' }).click()
    await page.getByRole('button', { name: 'Save phrase + selected chunks' }).click()

    await page.getByRole('link', { name: 'Practice' }).click()
    await expect(page.getByTestId('practice-drill-card')).toBeVisible()
    await expect(page.getByTestId('practice-drill-card')).not.toContainText(
      LONG_SOURCE.slice(0, 40),
    )
    await expect(page.getByTestId('practice-drill-card')).toContainText(
      /When you learn a new language|practicing every day|Phrases and sentences/i,
    )
  })

  test('save full phrase only skips chunk children', async ({ page }) => {
    await enterSourceText(page, LONG_SOURCE)
    await page.getByRole('button', { name: 'Translate' }).click()
    await expect(page.getByTestId('practice-chunks')).toBeVisible()
    await page.getByRole('button', { name: 'Save full phrase only' }).click()

    const items = await readPhrasebook(page)
    expect(items).toHaveLength(1)
    expect(items[0]?.parentId).toBeUndefined()
  })

  test('phrasebook offers Suggest chunks on long childless entries', async ({
    page,
  }) => {
    await enterSourceText(page, LONG_SOURCE)
    await page.getByRole('button', { name: 'Translate' }).click()
    await page.getByRole('button', { name: 'Save full phrase only' }).click()

    await page.getByRole('button', { name: 'Phrasebook' }).click()
    await expect(
      page.getByRole('button', { name: 'Suggest chunks' }),
    ).toBeVisible()
  })

  test('unlocked parent appears in Due after all children graduate', async ({
    page,
  }) => {
    await enterSourceText(page, LONG_SOURCE)
    await page.getByRole('button', { name: 'Translate' }).click()
    await page.getByRole('button', { name: 'Save phrase + selected chunks' }).click()

    await page.evaluate(() => {
      const raw = localStorage.getItem('myl-phrasebook')
      if (!raw) return
      const parsed = JSON.parse(raw) as PhrasebookPersist
      const graduated = {
        easeFactor: 2.5,
        intervalDays: 3,
        repetitions: 3,
        nextReviewAt: new Date(0).toISOString(),
        fluency: {
          graduatedAt: new Date().toISOString(),
          fastDays: ['2026-01-01', '2026-01-08', '2026-01-15'],
        },
      }
      const dueParent = {
        easeFactor: 2.5,
        intervalDays: 0,
        repetitions: 0,
        nextReviewAt: new Date(0).toISOString(),
      }
      for (const item of parsed.state.items) {
        if (item.parentId) {
          ;(item as { practiceStats?: unknown }).practiceStats = graduated
        } else {
          ;(item as { practiceStats?: unknown }).practiceStats = dueParent
        }
      }
      localStorage.setItem('myl-phrasebook', JSON.stringify(parsed))
    })

    await page.goto('/practice')
    await expect(page.getByTestId('practice-drill-card')).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByTestId('practice-drill-card')).toContainText(
      LONG_SOURCE.slice(0, 30),
    )
  })
})