# Bite-size Practice Chunks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let learners confirm short clause-sized practice cards from long Mandarin paragraphs, drill those chunks first, and unlock the full-paragraph card only after every chunk graduates fluency.

**Architecture:** Extend `PhrasebookEntry` with optional `parentId`. Add a practice-chunks suggest API (learnables-shaped) plus confirm UI. Gate locked parents out of Due/Speed via pure helpers in the practice queue. Persist `parent_id` in Neon like other phrasebook columns.

**Tech Stack:** Next.js App Router, TypeScript, Zustand phrasebook store, Vitest, shared `@mindyourlanguage/shared` types, OpenAI JSON helper (`fetchOpenAiJsonContent`), existing Card/Button UI.

**Design spec:** `docs/superpowers/specs/2026-11-16-bite-size-practice-chunks-design.md`

## Global Constraints

- Parent + child phrasebook cards only — do not stretch learnables into clause packs
- Suggest → confirm/edit before save; always allow **Save full phrase only**
- Chunk target size: short sense units (~15–20 ZH characters)
- Suggest when Mandarin length ≥ **40** characters; cap suggestions at **12**
- Unlock when **every** saved child has `practiceStats.fluency.graduatedAt`
- Locked parents excluded from Due and Speed; still listed in All saved
- Learnables behavior unchanged
- No merge/split UI, no soft/ramped parent scheduling, no new reliability metric
- Prefer small focused files under `apps/web/lib/practice-chunks/` and `apps/web/components/practice-chunks/`

---

## File map

| File | Responsibility |
|---|---|
| `packages/shared/src/types.ts` | `parentId` on `PhrasebookEntry`; chunk request/response types |
| `packages/shared/src/types.test.ts` | Type-shape smoke tests |
| `apps/web/lib/practice/chunk-lock.ts` | Pure parent/child + unlock helpers |
| `apps/web/lib/practice/chunk-lock.test.ts` | Unlock / children-of tests |
| `apps/web/lib/practice/practice-queue.ts` | Filter locked parents from Due/Speed; empty-copy note |
| `apps/web/lib/practice/practice-queue.test.ts` | Queue gating tests |
| `apps/web/lib/stores/phrasebook.ts` | Pass `parentId` in `createPhrasebookEntry`; cascade-remove children |
| `apps/web/lib/stores/phrasebook.test.ts` | `parentId` + cascade remove |
| `db/migrations/006_phrasebook_parent_id.sql` | `parent_id` column |
| `apps/web/lib/db/mappers.ts` | Map `parentId` ↔ `parent_id` |
| `apps/web/lib/db/phrasebook.ts` | SELECT/INSERT/UPDATE include `parent_id` |
| `apps/web/lib/db/mappers.test.ts` | Round-trip `parentId` |
| `apps/web/lib/practice-chunks/parse.ts` | Parse + validate model JSON |
| `apps/web/lib/practice-chunks/parse.test.ts` | Parse/validate tests |
| `apps/web/lib/practice-chunks/fetch.ts` | OpenAI prompt + fetch |
| `apps/web/lib/practice-chunks/save.ts` | Save parent + selected children |
| `apps/web/lib/practice-chunks/save.test.ts` | Save helper tests |
| `apps/web/lib/practice-chunks/index.ts` | Barrel exports |
| `apps/web/app/api/practice-chunks/route.ts` | POST endpoint |
| `apps/web/components/practice-chunks/practice-chunks-card.tsx` | Confirm UI |
| `apps/web/components/practice-chunks/practice-chunks-card.test.ts` | Card tests |
| `apps/web/components/practice-chunks/use-practice-chunks.ts` | Load/clear/save orchestration |
| `apps/web/app/page.tsx` | Mount chunks panel after long EN→ZH results |
| `apps/web/components/phrasebook-drawer.tsx` | “Suggest chunks” for long childless entries |
| `apps/web/app/practice/page.tsx` | Optional locked-parent hint in All mode if cheap |
| Spec + README | Link plan; mark approved; short product note |

---

### Task 1: Shared types + spec link

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/types.test.ts`
- Modify: `docs/superpowers/specs/2026-11-16-bite-size-practice-chunks-design.md`

**Interfaces:**
- Consumes: existing `PhrasebookEntry`, `CharacterSet`, `VoiceRegion`
- Produces: `parentId?: string` on `PhrasebookEntry`; `PracticeChunkSuggestion`; `PracticeChunksRequest`; `PracticeChunksResponse`; constants documented in parse module later (`MIN_CHUNKABLE_ZH_CHARS = 40`, `MAX_PRACTICE_CHUNKS = 12`)

- [ ] **Step 1: Write the failing type smoke test**

Append to `packages/shared/src/types.test.ts`:

```ts
describe('Practice chunks types', () => {
  it('accepts parentId on PhrasebookEntry and chunk request/response', () => {
    const parent: import('./types').PhrasebookEntry = {
      id: 'parent-1',
      translationId: null,
      sourceText: 'Long English paragraph…',
      sourceLang: 'en',
      targetLang: 'zh',
      translation: '很长的中文段落……',
      characterSet: 'simplified',
      dictionaryMatches: [],
      segments: [],
      tags: [],
      notes: '',
      createdAt: new Date().toISOString(),
    }
    const child: import('./types').PhrasebookEntry = {
      ...parent,
      id: 'child-1',
      sourceText: 'One idea',
      translation: '一个意思',
      parentId: 'parent-1',
    }
    const request: import('./types').PracticeChunksRequest = {
      sourceText: parent.sourceText,
      translation: parent.translation,
      characterSet: 'simplified',
      voiceRegion: 'zh-CN',
    }
    const response: import('./types').PracticeChunksResponse = {
      items: [
        {
          english: 'One idea',
          chinese: '一个意思',
          pinyin: 'yī gè yì si',
        },
      ],
    }

    expect(child.parentId).toBe('parent-1')
    expect(request.translation.length).toBeGreaterThan(0)
    expect(response.items[0]?.chinese).toBe('一个意思')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w @mindyourlanguage/shared -- src/types.test.ts`
Expected: FAIL (missing `PracticeChunksRequest` / `parentId` usage type errors, or property does not exist)

- [ ] **Step 3: Add types**

In `packages/shared/src/types.ts`, add `parentId?: string` to `PhrasebookEntry` (after `practiceStats?: PracticeStats`).

Append:

```ts
export interface PracticeChunkSuggestion {
  english: string
  chinese: string
  pinyin?: string
}

export interface PracticeChunksRequest {
  sourceText: string
  translation: string
  characterSet: CharacterSet
  voiceRegion?: VoiceRegion
}

export interface PracticeChunksResponse {
  items: PracticeChunkSuggestion[]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w @mindyourlanguage/shared -- src/types.test.ts`
Expected: PASS

- [ ] **Step 5: Point the spec at this plan**

In the design spec header, set:

```markdown
**Status:** Approved  
**Implementation plan:** `docs/superpowers/plans/2026-11-16-bite-size-practice-chunks.md`
```

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/types.test.ts \
  docs/superpowers/specs/2026-11-16-bite-size-practice-chunks-design.md \
  docs/superpowers/plans/2026-11-16-bite-size-practice-chunks.md
git commit -m "$(cat <<'EOF'
Add practice-chunk types and link the implementation plan.

EOF
)"
```

---

### Task 2: Chunk lock helpers (TDD)

**Files:**
- Create: `apps/web/lib/practice/chunk-lock.ts`
- Create: `apps/web/lib/practice/chunk-lock.test.ts`

**Interfaces:**
- Consumes: `PhrasebookEntry` from `@mindyourlanguage/shared`
- Produces:
  - `childrenOf(items: PhrasebookEntry[], parentId: string): PhrasebookEntry[]`
  - `hasChildren(items: PhrasebookEntry[], parentId: string): boolean`
  - `isParentUnlocked(items: PhrasebookEntry[], parent: PhrasebookEntry): boolean`
  - `isLockedParent(items: PhrasebookEntry[], entry: PhrasebookEntry): boolean`
  - `eligibleForChunkSuggest(entry: Pick<PhrasebookEntry, 'translation' | 'sourceLang' | 'targetLang' | 'id'>, items: PhrasebookEntry[], minZhChars?: number): boolean`
  - `zhCharLength(text: string): number`
  - `MIN_CHUNKABLE_ZH_CHARS = 40`

- [ ] **Step 1: Write failing tests**

Create `apps/web/lib/practice/chunk-lock.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { PhrasebookEntry } from '@mindyourlanguage/shared'
import {
  childrenOf,
  eligibleForChunkSuggest,
  isLockedParent,
  isParentUnlocked,
  MIN_CHUNKABLE_ZH_CHARS,
  zhCharLength,
} from './chunk-lock'

function entry(id: string, patch: Partial<PhrasebookEntry> = {}): PhrasebookEntry {
  return {
    id,
    translationId: null,
    sourceText: 'Hello',
    sourceLang: 'en',
    targetLang: 'zh',
    translation: '你好',
    characterSet: 'simplified',
    dictionaryMatches: [],
    segments: [],
    tags: [],
    notes: '',
    createdAt: '2026-11-16T00:00:00.000Z',
    ...patch,
  }
}

describe('zhCharLength', () => {
  it('counts Han characters', () => {
    expect(zhCharLength('一个意思。')).toBe(5)
    expect(zhCharLength('hi一个')).toBe(2)
  })
})

describe('parent unlock', () => {
  const parent = entry('p', {
    translation: '这是一段比较长的中文内容用来练习。',
  })

  it('locks parent while any child lacks graduatedAt', () => {
    const items = [
      parent,
      entry('c1', {
        parentId: 'p',
        practiceStats: {
          easeFactor: 2.5,
          intervalDays: 1,
          repetitions: 1,
          nextReviewAt: '2026-11-16T00:00:00.000Z',
          fluency: { graduatedAt: '2026-11-10T00:00:00.000Z', fastDays: ['2026-11-01', '2026-11-05', '2026-11-10'] },
        },
      }),
      entry('c2', { parentId: 'p' }),
    ]
    expect(isParentUnlocked(items, parent)).toBe(false)
    expect(isLockedParent(items, parent)).toBe(true)
  })

  it('unlocks when every child has graduatedAt', () => {
    const graduated = {
      easeFactor: 2.5,
      intervalDays: 1,
      repetitions: 3,
      nextReviewAt: '2026-11-16T00:00:00.000Z',
      fluency: {
        graduatedAt: '2026-11-10T00:00:00.000Z',
        fastDays: ['2026-11-01', '2026-11-05', '2026-11-10'],
      },
    }
    const items = [
      parent,
      entry('c1', { parentId: 'p', practiceStats: graduated }),
      entry('c2', { parentId: 'p', practiceStats: graduated }),
    ]
    expect(isParentUnlocked(items, parent)).toBe(true)
    expect(isLockedParent(items, parent)).toBe(false)
  })

  it('treats parent with no children as unlocked for queue purposes', () => {
    expect(isLockedParent([parent], parent)).toBe(false)
    expect(childrenOf([parent], 'p')).toEqual([])
  })
})

describe('eligibleForChunkSuggest', () => {
  it('requires long en→zh without existing children', () => {
    const longZh = '这是一段比较长的中文内容用来练习记忆的句子。'
    expect(zhCharLength(longZh)).toBeGreaterThanOrEqual(MIN_CHUNKABLE_ZH_CHARS)
    const parent = entry('p', { translation: longZh })
    expect(eligibleForChunkSuggest(parent, [parent])).toBe(true)
    expect(
      eligibleForChunkSuggest(parent, [parent, entry('c', { parentId: 'p' })]),
    ).toBe(false)
    expect(
      eligibleForChunkSuggest(entry('short', { translation: '你好吗' }), [
        entry('short', { translation: '你好吗' }),
      ]),
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -w apps/web -- lib/practice/chunk-lock.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement helpers**

Create `apps/web/lib/practice/chunk-lock.ts`:

```ts
import type { PhrasebookEntry } from '@mindyourlanguage/shared'

export const MIN_CHUNKABLE_ZH_CHARS = 40

const HAN = /\p{Script=Han}/gu

export function zhCharLength(text: string): number {
  return (text.match(HAN) ?? []).length
}

export function childrenOf(
  items: PhrasebookEntry[],
  parentId: string,
): PhrasebookEntry[] {
  return items.filter((item) => item.parentId === parentId)
}

export function hasChildren(
  items: PhrasebookEntry[],
  parentId: string,
): boolean {
  return items.some((item) => item.parentId === parentId)
}

/** True when the entry has children and every child has fluency.graduatedAt. */
export function isParentUnlocked(
  items: PhrasebookEntry[],
  parent: PhrasebookEntry,
): boolean {
  const kids = childrenOf(items, parent.id)
  if (kids.length === 0) return true
  return kids.every((child) => Boolean(child.practiceStats?.fluency?.graduatedAt))
}

/** Parents with children that are not yet all graduated. */
export function isLockedParent(
  items: PhrasebookEntry[],
  entry: PhrasebookEntry,
): boolean {
  if (!hasChildren(items, entry.id)) return false
  return !isParentUnlocked(items, entry)
}

export function eligibleForChunkSuggest(
  entry: Pick<
    PhrasebookEntry,
    'id' | 'translation' | 'sourceLang' | 'targetLang'
  >,
  items: PhrasebookEntry[],
  minZhChars: number = MIN_CHUNKABLE_ZH_CHARS,
): boolean {
  if (entry.sourceLang !== 'en' || entry.targetLang !== 'zh') return false
  if (zhCharLength(entry.translation) < minZhChars) return false
  if (hasChildren(items, entry.id)) return false
  return true
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -w apps/web -- lib/practice/chunk-lock.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/practice/chunk-lock.ts apps/web/lib/practice/chunk-lock.test.ts
git commit -m "$(cat <<'EOF'
Add parent/child unlock helpers for practice chunks.

EOF
)"
```

---

### Task 3: Practice queue gating (TDD)

**Files:**
- Modify: `apps/web/lib/practice/practice-queue.ts`
- Modify: `apps/web/lib/practice/practice-queue.test.ts`

**Interfaces:**
- Consumes: `isLockedParent` from `./chunk-lock`
- Produces: `buildPracticeQueue` excludes locked parents in `due` and `speed`; `all` keeps them; `practiceEmptyMessage` notes locked parents waiting on chunks when Due is otherwise empty

- [ ] **Step 1: Write failing queue tests**

Append to `apps/web/lib/practice/practice-queue.test.ts`:

```ts
describe('locked parent gating', () => {
  const parent = entry('parent', {
    sourceText: 'Long English',
    translation: '这是一段比较长的中文内容用来练习。',
    practiceStats: {
      easeFactor: 2.5,
      intervalDays: 0,
      repetitions: 1,
      nextReviewAt: '2026-01-01T00:00:00.000Z',
    },
  })
  const child = entry('child', {
    parentId: 'parent',
    sourceText: 'One idea',
    translation: '一个意思',
    practiceStats: {
      easeFactor: 2.5,
      intervalDays: 0,
      repetitions: 1,
      nextReviewAt: '2026-01-01T00:00:00.000Z',
    },
  })

  it('excludes locked parents from due and speed but keeps them in all', () => {
    const items = [parent, child]
    expect(buildPracticeQueue(items, 'due', '').map((row) => row.id)).toEqual([
      'child',
    ])
    expect(buildPracticeQueue(items, 'speed', '').map((row) => row.id)).toEqual([
      'child',
    ])
    expect(buildPracticeQueue(items, 'all', '').map((row) => row.id).sort()).toEqual(
      ['child', 'parent'].sort(),
    )
  })

  it('includes unlocked parents in due', () => {
    const graduatedChild = {
      ...child,
      practiceStats: {
        easeFactor: 2.5,
        intervalDays: 1,
        repetitions: 3,
        nextReviewAt: '2026-01-01T00:00:00.000Z',
        fluency: {
          graduatedAt: '2026-11-10T00:00:00.000Z',
          fastDays: ['2026-11-01', '2026-11-05', '2026-11-10'],
        },
      },
    }
    const items = [parent, graduatedChild]
    expect(buildPracticeQueue(items, 'due', '').map((row) => row.id).sort()).toEqual(
      ['child', 'parent'].sort(),
    )
  })
})

describe('practiceEmptyMessage locked parents', () => {
  it('mentions chunks when due is empty but locked parents exist', () => {
    const parent = entry('parent', {
      translation: '这是一段比较长的中文内容用来练习。',
      practiceStats: {
        easeFactor: 2.5,
        intervalDays: 1,
        repetitions: 1,
        nextReviewAt: '2099-01-01T00:00:00.000Z',
      },
    })
    const child = entry('child', {
      parentId: 'parent',
      practiceStats: {
        easeFactor: 2.5,
        intervalDays: 1,
        repetitions: 1,
        nextReviewAt: '2099-01-01T00:00:00.000Z',
      },
    })
    expect(practiceEmptyMessage('due', [parent, child], '')).toMatch(/chunk/i)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -w apps/web -- lib/practice/practice-queue.test.ts`
Expected: FAIL (locked parent still in due/speed; empty message lacks chunk note)

- [ ] **Step 3: Update queue**

In `apps/web/lib/practice/practice-queue.ts`:

```ts
import type { PhrasebookEntry } from '@mindyourlanguage/shared'
import { isLockedParent } from '@/lib/practice/chunk-lock'
import { getSpeedEntries } from '@/lib/practice/fluency'
import { getDueEntries } from '@/lib/practice/srs'
import { filterPhrasebookByTag } from '@/lib/stores/phrasebook'

export type DrillMode = 'due' | 'speed' | 'all'

export function isEnToZh(entry: PhrasebookEntry): boolean {
  return entry.sourceLang === 'en' && entry.targetLang === 'zh'
}

function withoutLockedParents(
  items: PhrasebookEntry[],
  pool: PhrasebookEntry[],
): PhrasebookEntry[] {
  return pool.filter((entry) => !isLockedParent(items, entry))
}

/** Phrases shown for the active practice mode (after tag filter). */
export function buildPracticeQueue(
  items: PhrasebookEntry[],
  mode: DrillMode,
  tagFilter: string,
): PhrasebookEntry[] {
  const tagged = filterPhrasebookByTag(items, tagFilter)
  if (mode === 'speed') {
    return withoutLockedParents(items, getSpeedEntries(tagged))
  }
  const base = mode === 'due' ? getDueEntries(tagged) : tagged
  const enZh = base.filter(isEnToZh)
  if (mode === 'all') return enZh
  return withoutLockedParents(items, enZh)
}

export function resolvePracticeEntry(
  mode: DrillMode,
  queue: PhrasebookEntry[],
  queueIndex: number,
  allItems: PhrasebookEntry[],
  pinnedEntryId: string | null,
): PhrasebookEntry | undefined {
  if (queue.length === 0) return undefined
  const index = Math.min(queueIndex, queue.length - 1)
  const fromQueue = queue[index]
  if (mode !== 'speed') return fromQueue
  if (!pinnedEntryId) return fromQueue
  return allItems.find((item) => item.id === pinnedEntryId) ?? fromQueue
}

export function practiceEmptyMessage(
  mode: DrillMode,
  items: PhrasebookEntry[],
  tagFilter: string,
): string {
  if (tagFilter.trim() && filterPhrasebookByTag(items, tagFilter).length === 0) {
    return 'No phrases match that tag.'
  }
  if (mode === 'due') {
    const hasLockedParent = items.some(
      (entry) => isEnToZh(entry) && isLockedParent(items, entry),
    )
    if (hasLockedParent) {
      return 'Nothing due today. Full paragraphs unlock after their practice chunks graduate.'
    }
    return 'Nothing due today. Save phrases from Translate, or switch to All saved.'
  }
  if (mode === 'all') {
    return 'No phrasebook entries yet. Translate and save a phrase to start drilling.'
  }
  const hasGraduatedPhrase = items.some(
    (entry) => isEnToZh(entry) && entry.practiceStats?.fluency?.graduatedAt,
  )
  if (hasGraduatedPhrase) {
    return 'Your phrases are in the speaking set. They come back here after about a month so they stay fast.'
  }
  return 'Speed starts after you recall a phrase once. Grade a due card, then come back.'
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -w apps/web -- lib/practice/practice-queue.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/practice/practice-queue.ts apps/web/lib/practice/practice-queue.test.ts
git commit -m "$(cat <<'EOF'
Gate locked parent paragraphs out of Due and Speed queues.

EOF
)"
```

---

### Task 4: Phrasebook `parentId` create + cascade remove

**Files:**
- Modify: `apps/web/lib/stores/phrasebook.ts`
- Modify: `apps/web/lib/stores/phrasebook.test.ts`

**Interfaces:**
- Consumes: `parentId?: string` on `PhrasebookEntry`
- Produces: `createPhrasebookEntry` copies `parentId`; `remove(id)` also removes entries whose `parentId === id`

- [ ] **Step 1: Write failing tests**

In `apps/web/lib/stores/phrasebook.test.ts`, add:

```ts
it('preserves parentId on create and cascade-removes children', () => {
  usePhrasebookStore.setState({ items: [] })
  const parent = createPhrasebookEntry({
    translationId: null,
    sourceText: 'Long',
    sourceLang: 'en',
    targetLang: 'zh',
    translation: '很长的句子用来测试。',
    characterSet: 'simplified',
    dictionaryMatches: [],
    segments: [],
  })
  const child = createPhrasebookEntry({
    translationId: null,
    sourceText: 'Bit',
    sourceLang: 'en',
    targetLang: 'zh',
    translation: '一句',
    characterSet: 'simplified',
    dictionaryMatches: [],
    segments: [],
    parentId: parent.id,
  })
  expect(child.parentId).toBe(parent.id)

  usePhrasebookStore.getState().add(parent)
  usePhrasebookStore.getState().add(child)
  usePhrasebookStore.getState().remove(parent.id)
  expect(usePhrasebookStore.getState().items).toHaveLength(0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w apps/web -- lib/stores/phrasebook.test.ts`
Expected: FAIL (`parentId` dropped and/or child remains)

- [ ] **Step 3: Implement**

In `createPhrasebookEntry`, include `parentId: input.parentId` in the returned object.

Change `remove` to:

```ts
remove: (id) =>
  set((state) => ({
    items: state.items.filter(
      (item) => item.id !== id && item.parentId !== id,
    ),
  })),
```

Ensure the `createPhrasebookEntry` input type allows optional `parentId` (it already spreads from `Omit<PhrasebookEntry, …>` once `parentId` exists on the type).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -w apps/web -- lib/stores/phrasebook.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/stores/phrasebook.ts apps/web/lib/stores/phrasebook.test.ts
git commit -m "$(cat <<'EOF'
Persist parentId on phrasebook create and cascade-remove children.

EOF
)"
```

---

### Task 5: Neon `parent_id` persistence

**Files:**
- Create: `db/migrations/006_phrasebook_parent_id.sql`
- Modify: `apps/web/lib/db/mappers.ts`
- Modify: `apps/web/lib/db/mappers.test.ts`
- Modify: `apps/web/lib/db/phrasebook.ts`
- Modify: `apps/web/lib/db/phrasebook.test.ts` (extend fixtures if they assert column lists / round-trips)

**Interfaces:**
- Consumes: `PhrasebookEntry.parentId`
- Produces: DB column `parent_id TEXT NULL`; mapper round-trip; upsert writes the column

- [ ] **Step 1: Migration**

Create `db/migrations/006_phrasebook_parent_id.sql`:

```sql
-- Bite-size practice chunks: link clause cards to a full-paragraph parent.
ALTER TABLE phrasebook
  ADD COLUMN IF NOT EXISTS parent_id TEXT;

CREATE INDEX IF NOT EXISTS idx_phrasebook_parent_id
  ON phrasebook(parent_id)
  WHERE parent_id IS NOT NULL;
```

- [ ] **Step 2: Write failing mapper test**

Extend the phrasebook round-trip test in `apps/web/lib/db/mappers.test.ts` so an entry with `parentId: 'parent-1'` survives `entryToPhrasebookRow` → `phrasebookRowToEntry`.

- [ ] **Step 3: Run mapper test to verify it fails**

Run: `npm run test -w apps/web -- lib/db/mappers.test.ts`
Expected: FAIL (`parentId` lost)

- [ ] **Step 4: Update mappers + SQL**

- Add `parent_id: string | null` to `PhrasebookRow`
- Map `parentId: row.parent_id ?? undefined` in `phrasebookRowToEntry`
- Map `parent_id: entry.parentId ?? null` in `entryToPhrasebookRow`
- Update every `SELECT` / `INSERT` / `ON CONFLICT` in `apps/web/lib/db/phrasebook.ts` to include `parent_id`

- [ ] **Step 5: Run DB-related unit tests**

Run: `npm run test -w apps/web -- lib/db/mappers.test.ts lib/db/phrasebook.test.ts`
Expected: PASS (phrasebook tests that mock `query` may need an extra bind arg — update expectations)

- [ ] **Step 6: Commit**

```bash
git add db/migrations/006_phrasebook_parent_id.sql \
  apps/web/lib/db/mappers.ts apps/web/lib/db/mappers.test.ts \
  apps/web/lib/db/phrasebook.ts apps/web/lib/db/phrasebook.test.ts
git commit -m "$(cat <<'EOF'
Persist phrasebook parent_id for practice chunk sync.

EOF
)"
```

---

### Task 6: Parse / validate practice-chunk suggestions (TDD)

**Files:**
- Create: `apps/web/lib/practice-chunks/parse.ts`
- Create: `apps/web/lib/practice-chunks/parse.test.ts`
- Create: `apps/web/lib/practice-chunks/index.ts`

**Interfaces:**
- Consumes: `PracticeChunkSuggestion`
- Produces:
  - `MAX_PRACTICE_CHUNKS = 12`
  - `parsePracticeChunksResponse(content: string): PracticeChunkSuggestion[]`
  - `phrasebookFieldsFromChunk(item: PracticeChunkSuggestion, characterSet: CharacterSet, parentId: string)`

- [ ] **Step 1: Write failing parse tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  MAX_PRACTICE_CHUNKS,
  parsePracticeChunksResponse,
  phrasebookFieldsFromChunk,
} from './parse'

describe('parsePracticeChunksResponse', () => {
  it('keeps valid ordered chunks and drops empties/duplicates', () => {
    const content = JSON.stringify({
      items: [
        { english: 'One idea', chinese: '一个意思' },
        { english: '', chinese: '空' },
        { english: 'One idea', chinese: '一个意思' },
        { english: 'Next', chinese: '下一个' },
      ],
    })
    expect(parsePracticeChunksResponse(content)).toEqual([
      { english: 'One idea', chinese: '一个意思' },
      { english: 'Next', chinese: '下一个' },
    ])
  })

  it('caps at MAX_PRACTICE_CHUNKS', () => {
    const items = Array.from({ length: MAX_PRACTICE_CHUNKS + 5 }, (_, i) => ({
      english: `E${i}`,
      chinese: `中${i}`,
    }))
    expect(parsePracticeChunksResponse(JSON.stringify({ items }))).toHaveLength(
      MAX_PRACTICE_CHUNKS,
    )
  })

  it('returns [] on bad JSON', () => {
    expect(parsePracticeChunksResponse('nope')).toEqual([])
  })
})

describe('phrasebookFieldsFromChunk', () => {
  it('maps chunk fields onto a child phrasebook create payload', () => {
    expect(
      phrasebookFieldsFromChunk(
        { english: 'One idea', chinese: '一个意思', pinyin: 'yī gè yì si' },
        'simplified',
        'parent-1',
      ),
    ).toMatchObject({
      sourceText: 'One idea',
      translation: '一个意思',
      pinyin: 'yī gè yì si',
      parentId: 'parent-1',
      sourceLang: 'en',
      targetLang: 'zh',
      characterSet: 'simplified',
      translationId: null,
      tags: ['chunk'],
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -w apps/web -- lib/practice-chunks/parse.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement parse module + barrel**

```ts
import type {
  CharacterSet,
  PracticeChunkSuggestion,
} from '@mindyourlanguage/shared'
import { normalizeChineseKey } from '@/lib/characters'

export const MAX_PRACTICE_CHUNKS = 12

export function phrasebookFieldsFromChunk(
  item: PracticeChunkSuggestion,
  characterSet: CharacterSet,
  parentId: string,
) {
  return {
    translationId: null as null,
    sourceText: item.english,
    sourceLang: 'en' as const,
    targetLang: 'zh' as const,
    translation: item.chinese,
    pinyin: item.pinyin,
    characterSet,
    parentId,
    tags: ['chunk'],
    notes: '',
  }
}

function readChunk(raw: unknown): PracticeChunkSuggestion | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const english = typeof row.english === 'string' ? row.english.trim() : ''
  const chinese = typeof row.chinese === 'string' ? row.chinese.trim() : ''
  const pinyin =
    typeof row.pinyin === 'string' && row.pinyin.trim()
      ? row.pinyin.trim()
      : undefined
  if (!english || !chinese) return null
  return pinyin ? { english, chinese, pinyin } : { english, chinese }
}

export function parsePracticeChunksResponse(
  content: string,
): PracticeChunkSuggestion[] {
  try {
    const parsed = JSON.parse(content) as { items?: unknown }
    if (!Array.isArray(parsed.items)) return []

    const out: PracticeChunkSuggestion[] = []
    const seen = new Set<string>()
    for (const raw of parsed.items) {
      const item = readChunk(raw)
      if (!item) continue
      const key = `${item.english}::${normalizeChineseKey(item.chinese)}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(item)
      if (out.length >= MAX_PRACTICE_CHUNKS) break
    }
    return out
  } catch {
    return []
  }
}
```

`apps/web/lib/practice-chunks/index.ts`:

```ts
export {
  MAX_PRACTICE_CHUNKS,
  parsePracticeChunksResponse,
  phrasebookFieldsFromChunk,
} from './parse'
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -w apps/web -- lib/practice-chunks/parse.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/practice-chunks/parse.ts \
  apps/web/lib/practice-chunks/parse.test.ts \
  apps/web/lib/practice-chunks/index.ts
git commit -m "$(cat <<'EOF'
Add practice-chunk suggestion parsing and field mapping.

EOF
)"
```

---

### Task 7: Fetch + API route

**Files:**
- Create: `apps/web/lib/practice-chunks/fetch.ts`
- Create: `apps/web/app/api/practice-chunks/route.ts`
- Modify: `apps/web/lib/practice-chunks/index.ts`

**Interfaces:**
- Consumes: `fetchOpenAiJsonContent`, `parsePracticeChunksResponse`, `MAX_PRACTICE_CHUNKS`
- Produces: `fetchPracticeChunks(input): Promise<PracticeChunkSuggestion[]>`; `POST /api/practice-chunks` → `{ items }` (empty array on failure)

Mirror `apps/web/app/api/learnables/route.ts` for auth rate limit + 1000-char cap + soft-fail to `{ items: [] }`.

- [ ] **Step 1: Implement fetch**

Create `apps/web/lib/practice-chunks/fetch.ts` following `apps/web/lib/learnables/fetch.ts`, with system prompt:

- Split the Mandarin translation into up to `MAX_PRACTICE_CHUNKS` short clause-sized learnable units (~15–20 Chinese characters / one sense unit)
- Keep fixed phrases together when they belong as one unit
- Cover the paragraph without large leftover gaps
- Do not return the full paragraph as one item
- JSON shape: `{ "items": [ { "english": string, "chinese": string, "pinyin"?: string } ] }`

Use model env fallback: `process.env.PRACTICE_CHUNKS_MODEL` then `process.env.LEARNABLES_MODEL` then `process.env.NATIVE_ALT_MODEL`.

- [ ] **Step 2: Implement route**

`apps/web/app/api/practice-chunks/route.ts` — same validation/rate-limit pattern as learnables; require `sourceText`, `translation`, `characterSet`; call `fetchPracticeChunks`; on error log and return `{ items: [] }`.

- [ ] **Step 3: Export from barrel**

```ts
export { fetchPracticeChunks } from './fetch'
```

- [ ] **Step 4: Smoke-check TypeScript on the route**

Run: `npm run test -w apps/web -- lib/practice-chunks/parse.test.ts`
Expected: PASS (no route unit test required if pattern matches learnables; optional thin test only if easy)

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/practice-chunks/fetch.ts \
  apps/web/lib/practice-chunks/index.ts \
  apps/web/app/api/practice-chunks/route.ts
git commit -m "$(cat <<'EOF'
Add practice-chunks OpenAI fetch and API route.

EOF
)"
```

---

### Task 8: Save parent + selected chunks (TDD)

**Files:**
- Create: `apps/web/lib/practice-chunks/save.ts`
- Create: `apps/web/lib/practice-chunks/save.test.ts`
- Modify: `apps/web/lib/practice-chunks/index.ts`

**Interfaces:**
- Consumes: `createPhrasebookEntry`, `usePhrasebookStore`, `phrasebookFieldsFromChunk`, `createInitialPracticeStats`
- Produces:

```ts
export function savePracticeChunksToPhrasebook(input: {
  parent: Omit<PhrasebookEntry, 'id' | 'createdAt' | 'tags' | 'notes'> & {
    tags?: string[]
    notes?: string
    id?: string // when chunking an existing phrasebook row
  }
  chunks: PracticeChunkSuggestion[]
  characterSet: CharacterSet
}): { parentId: string; savedChunkCount: number }
```

Behavior:
- If `input.parent.id` is provided and already in the store, reuse that parent id (do not duplicate the parent)
- Otherwise `add(createPhrasebookEntry(parentFields))` and use the new id
- For each chunk: `add(createPhrasebookEntry({ ...phrasebookFieldsFromChunk(...), dictionaryMatches: [], segments: [], practiceStats: createInitialPracticeStats() }))`
- Skip a chunk if its Chinese is already saved (`isChineseAlreadySaved`)
- Return counts

- [ ] **Step 1: Write failing save tests** (reset store; assert parent + N children with `parentId`)

- [ ] **Step 2: Run to verify fail**

Run: `npm run test -w apps/web -- lib/practice-chunks/save.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `save.ts` + export**

- [ ] **Step 4: Run to verify pass**

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/practice-chunks/save.ts \
  apps/web/lib/practice-chunks/save.test.ts \
  apps/web/lib/practice-chunks/index.ts
git commit -m "$(cat <<'EOF'
Save confirmed practice chunks as parent-linked phrasebook cards.

EOF
)"
```

---

### Task 9: Practice chunks confirm UI + hook

**Files:**
- Create: `apps/web/components/practice-chunks/practice-chunks-card.tsx`
- Create: `apps/web/components/practice-chunks/practice-chunks-card.test.ts`
- Create: `apps/web/components/practice-chunks/use-practice-chunks.ts`

**Interfaces:**
- Consumes: `PracticeChunkSuggestion`, `savePracticeChunksToPhrasebook`, `/api/practice-chunks`
- Produces:
  - `PracticeChunksCard` props: `items`, `loading?`, `characterSet`, `onSaveSelected(items)`, `onSaveFullOnly?`, editable english/chinese per row (controlled local draft state)
  - `usePracticeChunks(voiceRegion, characterSet)` → `{ items, loading, visible, clear, load(sourceText, translation), saveSelected(selected, parentFields), saveFullOnly?(parentFields) }`

UI copy:
- Title: **Practice chunks**
- Subtitle: Pick short clauses to memorize first. The full paragraph unlocks after these graduate.
- Primary button: **Save phrase + selected chunks**
- Secondary (optional prop): **Save full phrase only**

Follow patterns in `learnable-suggestions-card.tsx` / `use-learnable-suggestions.ts` (request id cancel, toast on save, soft-hide when empty and not loading).

- [ ] **Step 1: Write a small card test** (renders title; calls `onSaveSelected` with checked items) using `react` `createElement` like learnables card tests

- [ ] **Step 2: Run to verify fail**

Run: `npm run test -w apps/web -- components/practice-chunks/practice-chunks-card.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement card + hook**

Local draft edits: keep `Map`/array of `{ ...item, english, chinese }` so edits feed `onSaveSelected`. Uncheck removes from selection. Empty english/chinese on a checked row disables primary save (or filters them out with toast — prefer disable + `aria-invalid`).

- [ ] **Step 4: Run card test — PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/practice-chunks/
git commit -m "$(cat <<'EOF'
Add practice-chunks confirm card and load/save hook.

EOF
)"
```

---

### Task 10: Wire Translate home page

**Files:**
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/components/result-card.tsx` (optional hint text only)

**Interfaces:**
- Consumes: `usePracticeChunks`, `PracticeChunksCard`, `zhCharLength` / `MIN_CHUNKABLE_ZH_CHARS`, existing save path for full phrase
- Produces: After EN→ZH result with `zhCharLength(result.translation) >= 40`, `practiceChunks.load(sourceText, translation)`; render card under ResultCard (learnables may also show); primary save on chunks card saves parent from current result fields + selected chunks; secondary triggers existing full-phrase save only

- [ ] **Step 1: Integrate hook next to learnables on `page.tsx`**

- On successful EN→ZH translate, if long enough, call `practiceChunks.load(...)`
- On clear / new translate, `practiceChunks.clear()`
- Render:

```tsx
{isEnglishToChinese && practiceChunks.visible ? (
  <PracticeChunksCard
    items={practiceChunks.items}
    loading={practiceChunks.loading}
    characterSet={characterSet}
    onSaveSelected={(selected) =>
      practiceChunks.saveSelected(selected, parentFieldsFromResult)
    }
    onSaveFullOnly={handleToggleSave /* or dedicated save-full helper */}
  />
) : null}
```

Build `parentFieldsFromResult` from the same fields used by today’s phrasebook save (translation id, source/translation text, segments, dictionaryMatches, etc.).

If the user already saved the full phrase via ResultCard, chunk save should pass the existing phrasebook entry id when `isSaved` so children attach to that parent (look up via store).

- [ ] **Step 2: Adjust ResultCard hint** so it can mention chunks when visible (e.g. “Or break it into practice chunks below.”) without breaking learnables hint — prefer a small composed hint in `page.tsx` via `phrasebookHint`.

- [ ] **Step 3: Manual sanity** — `npm run test -w apps/web` for regressions

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/page.tsx apps/web/components/result-card.tsx
git commit -m "$(cat <<'EOF'
Wire practice-chunk suggestions into the translate result flow.

EOF
)"
```

---

### Task 11: Phrasebook “Suggest chunks” for existing long entries

**Files:**
- Modify: `apps/web/components/phrasebook-drawer.tsx`
- Possibly reuse `PracticeChunksCard` in a lightweight inline panel / dialog inside the drawer

**Interfaces:**
- Consumes: `eligibleForChunkSuggest`, `usePracticeChunks` (or a one-off fetch), `savePracticeChunksToPhrasebook` with `{ parent: { ...entry, id: entry.id }, chunks }`
- Produces: For each eligible entry, a **Suggest chunks** button; on success show the same confirm card; saving attaches children to that entry id

- [ ] **Step 1: Add Suggest chunks button when `eligibleForChunkSuggest(item, items)`**

- [ ] **Step 2: On click, load suggestions for that entry’s `sourceText`/`translation`; render confirm UI (drawer-local state holding `activeChunkParentId`)

- [ ] **Step 3: On save selected, call save helper with existing parent id; toast; clear panel**

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/phrasebook-drawer.tsx
git commit -m "$(cat <<'EOF'
Offer Suggest chunks for existing long phrasebook entries.

EOF
)"
```

---

### Task 12: Practice All-mode parent hint + docs polish

**Files:**
- Modify: `apps/web/app/practice/page.tsx` and/or drill list label if parents are shown in All mode — show a short muted line under parent cards: `Chunks in progress` / `Unlocked` using `hasChildren` + `isParentUnlocked`
- Modify: `README.md` — one sentence under practice about bite-size chunks
- Modify: design spec status already set in Task 1 — confirm still accurate

- [ ] **Step 1: Add muted status text for parents in All mode only (keep Due/Speed unchanged)**

Helper for copy:

```ts
export function parentChunkStatus(
  items: PhrasebookEntry[],
  entry: PhrasebookEntry,
): string | null {
  if (!hasChildren(items, entry.id)) return null
  return isParentUnlocked(items, entry)
    ? 'Unlocked — full paragraph ready'
    : 'Chunks in progress'
}
```

(Add to `chunk-lock.ts` + a tiny test.)

- [ ] **Step 2: README note**

- [ ] **Step 3: Full unit suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/practice/chunk-lock.ts apps/web/lib/practice/chunk-lock.test.ts \
  apps/web/app/practice/page.tsx README.md
git commit -m "$(cat <<'EOF'
Surface chunk progress on practice parents and document the feature.

EOF
)"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|---|---|
| `parentId` data model | 1, 4, 5 |
| Suggest API + validate/cap | 6, 7 |
| Confirm UI + edit/uncheck | 9 |
| Translate integration + save full only | 10 |
| Phrasebook Suggest chunks | 11 |
| Due/Speed lock until all children graduated | 2, 3 |
| All saved lists parents with status | 12 |
| Learnables unchanged | Global constraint; no learnables file edits |
| Soft-fail suggest | 7, 9, 10 |
| Tests for queue/unlock/parse/save/UI | 2–4, 6, 8, 9 |
| Neon persistence | 5 |

No intentional TBDs. Threshold **40** and cap **12** match the approved spec.
