# Long Document Native Navigation Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single-trigger SiYuan native navigation fallback for far-away missing matches so long-document jumps can recover when DOM lazy loading stalls at the current boundary.

**Architecture:** Keep the existing DOM/direct-protyle/approximate-scroll paths unchanged for nearby or already-rendered hits. Only when the target match is missing, far outside the visible loaded block range, and a live plugin instance is available, trigger one native block navigation request, hold pending-navigation open during the wait window, and resume the existing reveal flow when editor context returns.

**Tech Stack:** TypeScript, Vue 3 store/controller modules, Vitest with jsdom, SiYuan plugin API mocks

---

### Task 1: Reproduce The Long-Distance Failure In Store Tests

**Files:**
- Modify: `tests/mocks/siyuan.ts`
- Modify: `tests/store-context.test.ts`
- Test: `tests/store-context.test.ts`

- [x] **Step 1: Write the failing test**

Add SiYuan mock exports for `openTab` / `openMobileFileById`, then add a store regression test that:
- starts on a loaded block around index `125`
- jumps to a missing target around index `563`
- expects `openTab` to fire once with the fixed `TProtyleAction[]`
- drops editor context temporarily
- restores a new context containing the target block
- expects pending navigation to clear without a second native trigger

- [x] **Step 2: Run test to verify it fails**

Run: `corepack pnpm test -- tests/store-context.test.ts -t "uses native block navigation for far missing matches and resumes after the editor context returns"`
Expected: FAIL because `openTab` is never called by the current pending-navigation flow.

- [x] **Step 3: Write minimal implementation support in test mocks**

Keep the mock additions narrow:

```ts
export const openMobileFileById = vi.fn()
export const openTab = vi.fn(async () => ({}))
```

- [x] **Step 4: Commit**

Deferred. Keep test and implementation changes together in one bugfix commit.

### Task 2: Add The Native Navigation Helper

**Files:**
- Create: `src/features/search-replace/native-navigation.ts`
- Test: `tests/store-context.test.ts`

- [x] **Step 1: Write the helper contract**

Create an internal helper that owns:
- the fixed native action list
- plugin/app availability checks
- desktop vs mobile API selection
- a stable result union: `'triggered' | 'unsupported' | 'failed'`

- [x] **Step 2: Implement the minimal helper**

Implementation shape:

```ts
export function canTriggerNativeMatchNavigation(match: SearchMatch) { ... }

export async function triggerNativeMatchNavigation(
  match: SearchMatch,
): Promise<'triggered' | 'unsupported' | 'failed'> { ... }
```

- [x] **Step 3: Preserve existing boundaries**

Do not let this helper:
- trigger for attribute-view matches
- open a new tab
- throw into the pending-navigation retry loop

- [x] **Step 4: Commit**

Deferred. Keep helper wiring in the same bugfix commit.

### Task 3: Wire Native Fallback Into Pending Navigation

**Files:**
- Modify: `src/features/search-replace/store/search-pending-navigation.ts`
- Test: `tests/store-context.test.ts`

- [x] **Step 1: Add pending native-navigation state**

Track:
- attempted match id
- wait deadline

Reset that state in both:
- `beginPendingNavigation`
- `clearPendingNavigation`

- [x] **Step 2: Trigger native fallback only on the far-missing branch**

Gate on all of:
- direct scroll result is `missing`
- native navigation is actually available
- target block index is at least `20` blocks outside the loaded range
- current match has not already triggered native fallback in this pending cycle

- [x] **Step 3: Keep pending navigation alive while native loading is in flight**

When editor context is temporarily unavailable during the native wait window:
- do not clear pending navigation as `context-mismatch`
- reschedule retry and keep `navigationHint`

- [x] **Step 4: Fall back safely when native navigation is unavailable**

If native navigation cannot run:
- do not hijack the old DOM/protyle logic
- let the existing pending-navigation behavior continue unchanged

- [x] **Step 5: Commit**

Deferred. Keep wiring and regression proof together in one bugfix commit.

### Task 4: Verify Regression Coverage And Update Docs

**Files:**
- Modify: `docs/project-structure.md`
- Create: `docs/superpowers/plans/2026-04-11-long-document-native-navigation-fallback.md`
- Test: `tests/store-context.test.ts`

- [x] **Step 1: Run the focused regression suite**

Run: `corepack pnpm test -- tests/store-context.test.ts`
Expected: PASS. In this repository, that command currently executes the full Vitest suite, so it also verifies that existing navigation regressions still pass.

- [x] **Step 2: Update the module map**

Record the new helper in `docs/project-structure.md` so future navigation work does not bury the native fallback inside the pending-navigation state machine.

- [x] **Step 3: Commit**

Deferred. User did not request a commit in this session.
