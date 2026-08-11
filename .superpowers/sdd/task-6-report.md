# Task 6 Report: E2E smoke + README

## Status

DONE

## Commit

- `1b9052d` Document Phase 5.5 and cover reliability needle in e2e.

## Changes

### `apps/web/e2e/practice.spec.ts`

- Extended the existing `practice page drills a saved phrasebook entry` flow.
- Kept the existing navigation, reveal, answer visibility, and `grade-good` click assertions.
- Added `reliability-needle` visibility before reveal/grade.
- Added `reliability-needle` visibility after grade.
- Added the post-grade assertions from the brief:
  - empty unlock copy is absent
  - `Based on self-grades` remains visible

### `README.md`

- Updated the status line to reflect Phases 0-5 on `main` and Phase 5.5 reliability needle implemented on this branch.
- Added the Phase 5.5 design and plan links under the v2 docs list.
- Updated the Practice feature row to mention the production reliability needle on `/practice`.
- Updated the v2 implementation summary to distinguish Phases 0-5 on `main` from Phase 5.5 on this branch.

## Verification

### E2E

Command:

```bash
npm run test:e2e -w apps/web
```

Initial result:

- Failed because the Playwright Chromium executable was missing:
  - `/home/ubuntu/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell`

Remediation:

```bash
cd apps/web && npx playwright install chromium
```

Retry result:

- `7 passed (8.1s)`

Observed warning:

- Next.js warned about multiple lockfiles and inferred `/workspace/package-lock.json` as the workspace root while also detecting this worktree's `package-lock.json`. This did not fail the e2e run.

### Unit tests

Command:

```bash
npm test -w apps/web
```

Result:

- `22 passed (22)` test files
- `116 passed (116)` tests

## Self-review

| Requirement | Result |
|---|---|
| Modify only `apps/web/e2e/practice.spec.ts` and `README.md` for implementation | Met |
| Merge reliability needle assertions into existing practice flow without duplicate reveal/grade clicks | Met |
| Keep existing e2e assertions | Met |
| Assert needle visible before/after grade | Met |
| Assert empty unlock copy gone after first grade | Met |
| Assert `Based on self-grades` visible | Met |
| README status reflects Phase 5.5 reliability needle on branch and Phases 0-5 on main | Met |
| README Practice row mentions production reliability needle on `/practice` | Met |
| README links Phase 5.5 spec and plan | Met |
| Run required e2e command | Met after installing Chromium |
| Run required web unit tests | Met |
| Commit with brief's message | Met |

## Concerns

- No code concerns found in self-review.
- Environment note: Playwright Chromium was not installed initially; installed with `npx playwright install chromium` and the e2e suite then passed.
- Existing/non-blocking e2e warning: Next.js reports multiple lockfiles during web server startup.

---

# Important Findings Fix Report

## Status

DONE

## Changes

- Updated `ReliabilityNeedle` empty-state gating to use `events.length === 0` via `shouldShowEmptyNeedle(events)`, so older history still shows the needle and 8-week sparkline even when 7/30-day windows are empty.
- Extracted `getSparklineSegments` for simple SVG sparkline geometry.
- Updated sparkline rendering to skip null weekly buckets, draw separate observed segments, and render observed points without connecting through missing weeks.
- Fixed README Phase 5 wording from "shipped on branch" to "shipped on main".

## Verification

Red checks:

```bash
npm test -w apps/web -- components/reliability-needle.test.ts
```

- First red run failed because the extracted helper module did not exist.
- Second red run failed on the expected sparkline assertion because a null weekly bucket was included as a baseline point.

Green checks:

```bash
npm test -w apps/web -- components/reliability-needle.test.ts
```

- Result: 1 test file passed; 2 tests passed.

```bash
npm test -w apps/web -- lib/practice/reliability.test.ts lib/stores/review-events.test.ts lib/stores/phrasebook.test.ts
```

- Result: 3 test files passed; 17 tests passed.

```bash
npm test -w apps/web
```

- Result: 23 test files passed; 118 tests passed.

## Concerns

- None.
