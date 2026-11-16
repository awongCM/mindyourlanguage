# Bite-size practice chunks (parent + child cards)

**Date:** 2026-11-16  
**Status:** Draft — awaiting user review  
**Author:** awongCM + Cursor Agent  
**Parent spec:** `docs/superpowers/specs/2026-07-13-mindyourlanguage-v2-design.md`  
**Prior practice:** Phase 5 production practice (`docs/superpowers/specs/2026-07-19-phase-5-production-practice-design.md`)  
**Depends on:** Phrasebook + SRS + fluency graduation already shipped  

---

## 1. Intent

Long saved Mandarin phrases (especially short paragraphs) are hard to memorize when Practice treats each phrasebook row as one flashcard. Learners need **bite-sized clause cards** for daily recall, then a **full-paragraph card** that unlocks only after those chunks are solid.

### Decisions locked in brainstorming

| Decision | Choice |
|---|---|
| Practice shape | Chunks for daily memorization **and** reassemble the full paragraph later |
| Chunk creation | Auto-suggest, then user confirms/edits before cards are saved |
| Full-paragraph timing | Parent enters Due/Speed **only after** all children are solid |
| Chunk size | Short clauses / sense units (~15–20 Chinese characters) |
| Architecture | Parent + child phrasebook cards (Approach 1), not practice-only UI chunking and not stretching learnables |

### Non-goals

- Replacing or redesigning learnables (“New bits to learn” vocab extraction)
- Auto-saving chunks without confirmation
- Nested chunk trees
- Auto-merge/split UI in v1 (edit + uncheck is enough)
- Rewriting the parent text from its children
- Silent retro-batch of every existing long entry

---

## 2. Scope

### In scope

| Item | Delivers |
|---|---|
| **Parent/child link** | Optional `parentId` on `PhrasebookEntry` |
| **Chunk suggestions API** | Propose ordered short EN↔ZH clauses from a long translation |
| **Confirm UI** | Pre-checked editable list; save parent + selected children |
| **Translate integration** | Show panel when Mandarin is long enough; keep “save full only” |
| **Phrasebook “Suggest chunks”** | Same confirm flow for existing long entries with no children |
| **Queue gating** | Locked parents excluded from Due/Speed until unlock |
| **Unlock rule** | Parent unlocks when every saved child has fluency `graduatedAt` |

### Out of scope (v1)

| Item | Notes |
|---|---|
| Merge/split chunk controls | Nice-to-have later |
| Soft/ramped parent scheduling | Explicitly rejected; hard gate only |
| New reliability metric for unlock | Reuse existing fluency graduation |
| Changing learnables cap or prompt | Keep vocab path separate |
| Forced attempt-before-reveal on chunks | Unchanged Phase 7 territory |

---

## 3. Data model

Extend `PhrasebookEntry` (shared types + Neon JSON as today):

```ts
parentId?: string // set on chunk cards; points at the full-paragraph entry id
```

| Role | Fields | Behavior |
|---|---|---|
| **Parent** | Full `sourceText` + `translation` (current save) | One card representing the whole paragraph |
| **Child** | Clause-sized EN `sourceText` + ZH `translation`; `parentId` set | Normal SRS/speed cards |

Rules:

- Only parents may have children; children are flat (no `parentId` pointing at another child).
- Learnables remain separate phrasebook rows (no `parentId` required).
- Sync continues to persist the full entry document; `parentId` is just another field.

---

## 4. Suggest → confirm → save

### When to suggest

After a successful EN→ZH translation, if Mandarin length is above a short threshold (about **40+ characters**), show a **Practice chunks** panel. Learnables may still appear for vocab; the two panels have different jobs.

### Suggestion API

- Endpoint shape: e.g. `POST /api/practice-chunks`
- Input: full English, full Mandarin, character set, optional segments
- Output: ordered `{ english, chinese, pinyin? }[]`
- Targets short sense units (~15–20 ZH chars); keep fixed phrases together when they belong as one unit
- Cover the paragraph without large leftover gaps
- Server validates: drop empties/duplicates, cap count (about **12**), reject unusable payloads

### Confirm UI

- Pre-checked list; user may uncheck or lightly edit EN/ZH
- Primary: **Save phrase + selected chunks** → always save parent; save each checked chunk with `parentId`
- Secondary: **Save full phrase only** → parent only, no children
- Inline validation blocks empty EN/ZH on confirm
- Child rows use the same phrasebook create path as a normal save where practical (character set, optional pinyin/segments enrichment); they are ordinary `PhrasebookEntry` values plus `parentId`

### Existing long cards

Phrasebook offers **Suggest chunks** on a long entry that has no children yet. Same confirm UI; no re-translate required.

### Failures

If suggestion fails or returns nothing useful, hide or soft-fail the panel. Saving the full phrase still works.

---

## 5. Practice queue & unlock

### Queue rules

| Mode | Children | Parents with children |
|---|---|---|
| **Due** | Normal SRS due set | Excluded until unlocked |
| **Speed** | Normal speed eligibility | Excluded until unlocked |
| **All saved** | Listed | Listed, with “chunks in progress” / “unlocked” hint |

### Unlock (“chunks are solid”)

A parent enters Due/Speed when **every saved child** has `practiceStats.fluency.graduatedAt` set (existing speed graduation: three fast days spanning at least six days).

After unlock:

- Parent is a normal hard card (full EN → produce full ZH)
- Children keep their own review schedules

### Edge cases

| Case | Behavior |
|---|---|
| All children deleted | Parent behaves like a normal single card again |
| Chunks added later to an unlocked parent | Parent locks again until the new child set all graduate |
| Child never enters / never completes speed | Does not count as graduated → parent stays locked |
| Due empty but locked parents exist | Keep existing empty copy; optional short note that parents are waiting on chunks |

---

## 6. Testing

| Area | Coverage |
|---|---|
| Queue filter | Locked parents omitted from Due/Speed; unlocked included; children unaffected |
| Unlock helper | All children graduated → unlocked; any missing `graduatedAt` → locked |
| Suggestion parse/validate | Empties, duplicates, cap, basic length sanity |
| Confirm save | Creates parent + children with correct `parentId` |
| Soft-fail | Suggest failure does not block full-phrase save |

No new E2E required for v1.

---

## 7. Acceptance criteria

1. Long EN→ZH results can suggest clause-sized chunks for confirm/edit before save.
2. Saving with chunks creates one parent and N child phrasebook entries linked by `parentId`.
3. Child cards appear in Due/Speed like normal cards; locked parents do not.
4. After every child has fluency graduation, the parent appears in Due/Speed.
5. User can still save the full phrase only, and can suggest chunks later from phrasebook for long childless entries.
6. Learnables behavior is unchanged.
)
