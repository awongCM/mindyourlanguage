# Phase 3 Web Speech TTS + History + Phrasebook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 3 for personal MVP — enable Play Mainland/Taiwan via the browser Web Speech API, persist the last 50 translations in a history drawer, and add an opt-outable local phrasebook — without any new TTS vendor account.

**Architecture:** Client-only `lib/speech.ts` wraps `speechSynthesis` (voice pick for `zh-CN` / `zh-TW`). Zustand + `persist` powers `myl-history` and `myl-phrasebook`. Phrasebook stays isolated so it can be removed later without touching TTS or history. No `/api/speak` in this phase; Google Cloud TTS remains a documented upgrade path.

**Tech Stack:** Next.js App Router, TypeScript, Zustand (+ persist), Web Speech API, Vitest, existing shadcn Sheet/Button/Card.

**Design spec:** `docs/superpowers/specs/2026-07-14-phase-3-tts-history-phrasebook-design.md`

---

## File map

| File | Responsibility |
|---|---|
| `apps/web/lib/speech.ts` | Web Speech helpers |
| `apps/web/lib/speech.test.ts` | Voice picker / support tests |
| `apps/web/components/result-card.tsx` | Play buttons + Save to phrasebook |
| `apps/web/lib/stores/history.ts` | History Zustand store |
| `apps/web/lib/stores/history.test.ts` | Cap / mutate tests |
| `apps/web/lib/to-translation-record.ts` | Map request+response → `TranslationRecord` |
| `apps/web/components/history-drawer.tsx` | History Sheet |
| `packages/shared/src/types.ts` | `PhrasebookEntry` |
| `apps/web/lib/stores/phrasebook.ts` | Phrasebook Zustand store |
| `apps/web/components/phrasebook-drawer.tsx` | Phrasebook Sheet |
| `apps/web/app/page.tsx` | Wire save/restore |
| `apps/web/app/layout.tsx` | Header triggers (or keep triggers on page) |
| `apps/web/package.json` | Add `zustand` |
| `apps/web/.env.example` | Note TTS is browser-based; leave Google vars commented for later |

---

## PR 3a — Web Speech TTS

### Task 1: Speech helper + tests

**Files:**
- Create: `apps/web/lib/speech.ts`
- Create: `apps/web/lib/speech.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/web/lib/speech.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cancelSpeech,
  isSpeechSynthesisSupported,
  pickVoice,
  speakChinese,
} from './speech'

function mockVoice(lang: string, name: string): SpeechSynthesisVoice {
  return { lang, name, default: false, localService: true, voiceURI: name } as SpeechSynthesisVoice
}

describe('isSpeechSynthesisSupported', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns false when speechSynthesis missing', () => {
    vi.stubGlobal('window', {})
    expect(isSpeechSynthesisSupported()).toBe(false)
  })
})

describe('pickVoice', () => {
  it('prefers exact zh-CN match for Mainland', () => {
    const voices = [
      mockVoice('zh-TW', 'TW'),
      mockVoice('zh-CN', 'CN'),
      mockVoice('en-US', 'US'),
    ]
    expect(pickVoice(voices, 'zh-CN')?.name).toBe('CN')
  })

  it('accepts cmn-TW prefix for Taiwan', () => {
    const voices = [mockVoice('cmn-TW', 'Taiwan'), mockVoice('zh-CN', 'CN')]
    expect(pickVoice(voices, 'zh-TW')?.name).toBe('Taiwan')
  })

  it('falls back to any zh voice when region missing', () => {
    const voices = [mockVoice('zh-CN', 'CN'), mockVoice('en-US', 'US')]
    expect(pickVoice(voices, 'zh-TW')?.name).toBe('CN')
  })
})

describe('speakChinese', () => {
  beforeEach(() => {
    const speak = vi.fn()
    const cancel = vi.fn()
    const getVoices = vi.fn().mockReturnValue([mockVoice('zh-CN', 'CN')])
    vi.stubGlobal('speechSynthesis', { speak, cancel, getVoices })
    vi.stubGlobal('SpeechSynthesisUtterance', function (this: any, text: string) {
      this.text = text
      this.lang = ''
      this.voice = null
      this.onend = null
      this.onerror = null
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('cancels prior speech and speaks with zh-CN', async () => {
    const p = speakChinese('你好', 'zh-CN')
    const utterance = vi.mocked(speechSynthesis.speak).mock.calls[0][0] as SpeechSynthesisUtterance
    expect(speechSynthesis.cancel).toHaveBeenCalled()
    expect(utterance.text).toBe('你好')
    expect(utterance.lang).toBe('zh-CN')
    utterance.onend?.(new Event('end') as SpeechSynthesisEvent)
    await p
  })

  it('rejects when unsupported', async () => {
    vi.stubGlobal('window', {})
    // re-import path: call with speechSynthesis undefined
    vi.stubGlobal('speechSynthesis', undefined)
    await expect(speakChinese('你好', 'zh-CN')).rejects.toThrow(/unavailable/i)
  })
})
```

Adjust mocks to match the real helper’s window checks; keep assertions on cancel + lang + voice pick.

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd /workspace/apps/web && npx vitest run lib/speech.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/speech.ts`**

```typescript
import type { VoiceRegion } from '@mindyourlanguage/shared'

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined'
}

export function cancelSpeech() {
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel()
}

function langCandidates(region: VoiceRegion): string[] {
  return region === 'zh-TW'
    ? ['zh-TW', 'zh-tw', 'cmn-TW', 'cmn-tw']
    : ['zh-CN', 'zh-cn', 'cmn-CN', 'cmn-cn']
}

export function pickVoice(
  voices: SpeechSynthesisVoice[],
  region: VoiceRegion,
): SpeechSynthesisVoice | null {
  const candidates = langCandidates(region)
  const exact = voices.find((v) => candidates.includes(v.lang))
  if (exact) return exact
  const prefix = voices.find((v) =>
    candidates.some((c) => v.lang.toLowerCase().startsWith(c.toLowerCase())),
  )
  if (prefix) return prefix
  return (
    voices.find((v) => {
      const lang = v.lang.toLowerCase()
      return lang.startsWith('zh') || lang.startsWith('cmn')
    }) ?? null
  )
}

function getVoices(): SpeechSynthesisVoice[] {
  return window.speechSynthesis.getVoices()
}

async function waitForVoices(timeoutMs = 500): Promise<SpeechSynthesisVoice[]> {
  const existing = getVoices()
  if (existing.length > 0) return existing
  return new Promise((resolve) => {
    const done = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', done)
      resolve(getVoices())
    }
    window.speechSynthesis.addEventListener('voiceschanged', done)
    setTimeout(done, timeoutMs)
  })
}

export async function speakChinese(
  text: string,
  region: VoiceRegion,
): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed) return
  if (!isSpeechSynthesisSupported()) {
    throw new Error('Audio unavailable')
  }

  cancelSpeech()
  const voices = await waitForVoices()
  const voice = pickVoice(voices, region)
  const utterance = new SpeechSynthesisUtterance(trimmed)
  utterance.lang = region
  if (voice) utterance.voice = voice

  await new Promise<void>((resolve, reject) => {
    utterance.onend = () => resolve()
    utterance.onerror = () => reject(new Error('Audio unavailable'))
    window.speechSynthesis.speak(utterance)
  })
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd /workspace/apps/web && npx vitest run lib/speech.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/speech.ts apps/web/lib/speech.test.ts
git commit -m "feat: add Web Speech API helper for CN and TW voices"
```

---

### Task 2: Wire Play buttons in result card

**Files:**
- Modify: `apps/web/components/result-card.tsx`

- [ ] **Step 1: Replace stubs**

- Import `speakChinese`, `cancelSpeech` from `@/lib/speech`.
- Remove `disabled` + “coming soon” titles from Play Mainland / Play Taiwan.
- On click:

```typescript
async function handlePlay(region: VoiceRegion) {
  try {
    await speakChinese(displayText, region)
  } catch {
    toast.error('Audio unavailable')
  }
}
```

- Call `cancelSpeech()` in a `useEffect` cleanup on unmount.
- Mainland → `'zh-CN'`; Taiwan → `'zh-TW'`.

- [ ] **Step 2: Manual smoke**

```bash
cd /workspace && npm run dev
```

Translate a short ZH line; click both Play buttons in Chrome. Expect audio or a clear toast if the environment has no voices.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/result-card.tsx
git commit -m "feat: enable Play Mainland and Taiwan via Web Speech API"
```

---

## PR 3b — Local history

### Task 3: Install Zustand + history store

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/lib/stores/history.ts`
- Create: `apps/web/lib/stores/history.test.ts`
- Create: `apps/web/lib/to-translation-record.ts`
- Create: `apps/web/lib/to-translation-record.test.ts`

- [ ] **Step 1: Install dependency**

```bash
cd /workspace && npm install zustand -w apps/web
```

- [ ] **Step 2: Write failing store + mapper tests**

`history.test.ts`: add three items with distinct ids when max is mocked small, or add 51 and assert length 50 and newest first.

`to-translation-record.test.ts`: map a fake request context + `TranslateResponse` into a full `TranslationRecord` including `sourceText` and `createdAt`.

- [ ] **Step 3: Implement**

```typescript
// lib/stores/history.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TranslationRecord } from '@mindyourlanguage/shared'

interface HistoryStore {
  items: TranslationRecord[]
  add: (record: TranslationRecord) => void
  remove: (id: string) => void
  clear: () => void
}

export const useHistoryStore = create<HistoryStore>()(
  persist(
    (set) => ({
      items: [],
      add: (record) =>
        set((s) => ({
          items: [record, ...s.items.filter((i) => i.id !== record.id)].slice(0, 50),
        })),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      clear: () => set({ items: [] }),
    }),
    { name: 'myl-history' },
  ),
)
```

```typescript
// lib/to-translation-record.ts
import type {
  CharacterSet,
  Lang,
  TranslateResponse,
  TranslationRecord,
} from '@mindyourlanguage/shared'

export function toTranslationRecord(input: {
  response: TranslateResponse
  sourceText: string
  sourceLang: Lang
  targetLang: Lang
  characterSet: CharacterSet
}): TranslationRecord {
  const { response, sourceText, sourceLang, targetLang, characterSet } = input
  return {
    id: response.id,
    userId: null,
    sourceText,
    sourceLang,
    targetLang,
    translation: response.translation,
    traditional: response.traditional,
    pinyin: response.pinyin,
    characterSet,
    register: response.register,
    nativeAlternative: response.nativeAlternative,
    dictionaryMatches: response.dictionaryMatches,
    segments: response.segments,
    createdAt: new Date().toISOString(),
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd /workspace/apps/web && npx vitest run lib/stores/history.test.ts lib/to-translation-record.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json package-lock.json apps/web/lib/stores/history.ts apps/web/lib/stores/history.test.ts apps/web/lib/to-translation-record.ts apps/web/lib/to-translation-record.test.ts
git commit -m "feat: add Zustand local history store capped at 50"
```

---

### Task 4: History drawer + page wiring

**Files:**
- Create: `apps/web/components/history-drawer.tsx`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/layout.tsx` (optional — prefer triggers on `page.tsx` to keep layout server-friendly)

- [ ] **Step 1: Build drawer**

Use `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle` from `@/components/ui/sheet`.

Props:

```typescript
interface HistoryDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (record: TranslationRecord) => void
}
```

- List `useHistoryStore().items`
- Click row → `onSelect(record)` + close
- Footer: Clear all (confirm via `window.confirm` or simple second click)

- [ ] **Step 2: Wire `page.tsx`**

- After successful translate: `add(toTranslationRecord(...))` with request context.
- Keep last submitted `sourceText` in state for mapping.
- `onSelect`: set `result` from record fields, set direction langs, set `characterSet`, rebuild a `TranslateResponse`-shaped object for existing cards.
- Add a “History” button that opens the drawer.

- [ ] **Step 3: Manual smoke**

Translate twice → refresh → open History → click older item → full result restores.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/history-drawer.tsx apps/web/app/page.tsx
git commit -m "feat: add local translation history drawer"
```

---

## PR 3c — Local phrasebook (opt-outable)

### Task 5: Shared type + phrasebook store

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/types.test.ts` (if present)
- Create: `apps/web/lib/stores/phrasebook.ts`
- Create: `apps/web/lib/stores/phrasebook.test.ts`

- [ ] **Step 1: Add type**

```typescript
export interface PhrasebookEntry {
  id: string
  translationId: string | null
  sourceText: string
  sourceLang: Lang
  targetLang: Lang
  translation: string
  traditional?: string
  pinyin?: string
  characterSet: CharacterSet
  nativeAlternative?: string
  tags: string[]
  notes: string
  createdAt: string
}
```

- [ ] **Step 2: Implement store**

Persist key: `myl-phrasebook`.

- `add` dedupes by `translationId` when present, else by `sourceText + translation`.
- `update`, `remove`, `clear`, `isSaved(translationId | source+translation)` helper.

- [ ] **Step 3: Tests for dedupe + remove**

- [ ] **Step 4: Commit**

```bash
git add packages/shared/ apps/web/lib/stores/phrasebook.ts apps/web/lib/stores/phrasebook.test.ts
git commit -m "feat: add local phrasebook store and shared entry type"
```

---

### Task 6: Phrasebook UI + Save button

**Files:**
- Create: `apps/web/components/phrasebook-drawer.tsx`
- Modify: `apps/web/components/result-card.tsx`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/.env.example`

- [ ] **Step 1: Save button on result card**

Extend props:

```typescript
interface ResultCardProps {
  result: TranslateResponse
  characterSet: CharacterSet
  isSaved?: boolean
  onToggleSave?: () => void
}
```

Render “Save to phrasebook” / “Saved” next to Copy. Only call `onToggleSave` if provided (keeps card usable if phrasebook opted out).

- [ ] **Step 2: Phrasebook drawer**

- List entries; show source → translation
- Optional tag text filter (simple substring / tag chip match)
- Inline notes edit (input + blur/save)
- Click → restore like history
- Remove entry

- [ ] **Step 3: Wire page**

- Build `PhrasebookEntry` from current result + source context on save
- Restore handler shared or parallel to history restore
- “Phrasebook” header/toolbar button

- [ ] **Step 4: Document opt-out + TTS notes in `.env.example`**

```
# Phase 3 TTS uses the browser Web Speech API (no key required).
# Optional later: Google Cloud TTS
# GOOGLE_TTS_API_KEY=

# Optional: hide phrasebook UI in a future change without migrations
# NEXT_PUBLIC_ENABLE_PHRASEBOOK=true
```

(Implement the feature flag only if cheap; otherwise document “remove drawer + Save props to opt out.” Prefer documenting over building unused flag plumbing.)

- [ ] **Step 5: Manual smoke**

Save a phrase → refresh → open Phrasebook → add a tag/note → restore → unsave.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/phrasebook-drawer.tsx apps/web/components/result-card.tsx apps/web/app/page.tsx apps/web/.env.example
git commit -m "feat: add local phrasebook drawer and save action"
```

---

## Execution order summary

| Task | PR | Depends on |
|---|---|---|
| 1 Speech helper | 3a | — |
| 2 Play buttons | 3a | 1 |
| 3 History store | 3b | — (parallel with 3a OK) |
| 4 History drawer | 3b | 3 |
| 5 Phrasebook store | 3c | — (after shared types) |
| 6 Phrasebook UI | 3c | 5, 2 (Save button on result card) |

Suggested branching: `cursor/phase-3a-web-speech-4d28` → `cursor/phase-3b-history-4d28` → `cursor/phase-3c-phrasebook-4d28`.

---

## Plan self-review

| Spec requirement | Task |
|---|---|
| Web Speech Play Mainland / Taiwan | 1, 2 |
| Toast on audio failure; no server `/api/speak` | 2 |
| History max 50 + restore full context | 3, 4 |
| Phrasebook save/tags/notes/filter; isolated | 5, 6 |
| Opt-out without TTS/history rewrite | 6 (optional Save props + isolated store) |
| Google/Azure TTS | Explicitly out of plan |

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-14-phase-3-tts-history-phrasebook.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks
2. **Inline Execution** — execute in-session with executing-plans checkpoints

After design approval, which approach should we use?
