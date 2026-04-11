# Long Document Native Navigation Plan

## Scope

- Date: `2026-04-06`
- Project: `siyuan-sou-easy`
- Goal: use SiYuan native navigation as a fallback for long-document search jumps that still time out under the current DOM lazy-load retry flow

## Summary

- Keep the existing DOM and approximate-scroll navigation path for nearby hits and already loaded blocks.
- Add a native fallback for long-distance missing-block jumps so SiYuan loads the target block region first, then let the plugin resume match highlighting and final positioning.
- Prefer the public plugin API path instead of kernel-only or internal Protyle-only solutions.
- Do not add a user setting for this behavior and do not intentionally open a new tab for the fallback.

## Preferred Approach

### Why this path

- The current implementation already handles most short-range jumps and visible-block cases well.
- Remaining failures are concentrated in long-distance jumps where the target block is not in the current DOM and the lazy-load retry loop stalls or times out.
- SiYuan already exposes native block-opening and Protyle action semantics through public plugin APIs, so the safest solution is to reuse those native behaviors instead of recreating editor loading logic in the plugin.

### Chosen fallback path

- Desktop / browser desktop:
  - call `openTab({ app: plugin.app, doc: { id: match.blockId, action }, openNewTab: false, removeCurrentTab: true })`
- Mobile:
  - call `openMobileFileById(plugin.app, match.blockId, action)`
- Fixed Protyle action list:
  - `cb-get-html`
  - `cb-get-hl`
  - `cb-get-focus`
  - `cb-get-unchangeid`
  - `cb-get-before`
  - `cb-get-append`

### Explicitly not chosen

- Do not use kernel API to simulate editor DOM loading.
  - `getDoc`, `getBlockDOMs`, `getChildBlocks`, and related APIs can help with snapshot/search data, but they do not provide a stable way to inject the target block region into the live editor DOM.
- Do not depend on internal Protyle instance mutation as the primary path.
  - It is more brittle across SiYuan upgrades than the public plugin API surface.
- Do not use `cb-get-scroll` in the first version.
  - Its type comment indicates it is intended for direct document opening with `rootID`, while this fallback is centered on block-id navigation.

## Implementation Changes

### 1. Add a native navigation helper

- Introduce a small helper under `src/features/search-replace/` dedicated to native fallback navigation.
- Input:
  - current `SearchMatch`
  - current editor root id
- Output:
  - `triggered`
  - `unsupported`
  - `failed`
- Responsibilities:
  - resolve plugin instance
  - choose desktop vs mobile API
  - build the fixed `TProtyleAction[]`
  - guard against unsupported states such as missing plugin instance or non-block results
  - catch API errors and return a stable result instead of throwing into the retry loop

### 2. Extend pending navigation decision logic

- Integrate the native helper into `search-pending-navigation.ts`.
- Trigger the native fallback only for regular document block matches.
- Do not trigger it for:
  - attribute-view results
  - matches already present in the current DOM
  - short-distance missing-block jumps that current scrolling can likely resolve

### 3. Trigger timing

- Trigger early, not only after the existing timeout is exhausted.
- Native fallback should fire when all of the following are true:
  - the current match block is missing from the live DOM
  - a `loadedBlockRange` exists
  - the target block is far away from the loaded visible boundary
- Use this distance rule:
  - if the target is outside the loaded range and the index delta from the nearest loaded boundary is `>= 20`, trigger native fallback
- Also allow fallback when the first retry already enters `waitingAtUpperBoundary` or `waitingAtLowerBoundary`

### 4. Single-trigger behavior per navigation cycle

- For one match within one pending-navigation lifecycle:
  - trigger native fallback at most once
- Add controller state for:
  - whether native fallback has already fired for the current match
  - whether a native request is currently in flight
  - when the native wait window expires
- Use an in-flight wait window of about `1500ms`
  - during this window, do not retrigger the native fallback
  - continue listening for editor/protyle events to know when native loading has likely completed

### 5. Resume plugin ownership after native load

- Reuse existing editor-context event handling rather than introducing a new polling-only flow.
- Treat these events as native-load completion signals:
  - `switch-protyle`
  - `loaded-protyle-static`
  - `loaded-protyle-dynamic`
- When they arrive:
  - re-resolve `EditorContext`
  - refresh matches if needed
  - run `revealCurrentMatch` again
  - let the existing scroll/highlight logic finish the final positioning

### 6. Fallback behavior on failure

- If native navigation is unsupported, throws, or does not produce a usable editor state before the wait window expires:
  - fall back to the existing DOM retry and timeout logic
- Do not clear:
  - current query
  - current match index
  - panel visibility
- Keep the navigation hint active while native fallback is in progress.

## Internal Interfaces

### New helper contract

- Suggested shape:
  - `triggerNativeMatchNavigation(match, currentRootId): Promise<'triggered' | 'unsupported' | 'failed'>`
- This helper should remain internal and should not be re-exported as a public store API.

### Pending navigation state additions

- Add internal state fields for:
  - native fallback already attempted for current match
  - native fallback in-flight expiry timestamp or equivalent timer state
  - last native fallback result for debug logging

### Debug logging

- Add new debug log events to keep native and DOM paths separately observable:
  - `pending-navigation:native-trigger`
  - `pending-navigation:native-skip`
  - `pending-navigation:native-wait`
  - `pending-navigation:native-fail`
  - `pending-navigation:native-resume`

## Test Plan

### Unit / store behavior

- Desktop path:
  - when a long-distance missing block is selected, the controller calls `openTab` with the expected `doc.id` and fixed `action` list
- Mobile path:
  - when the frontend is mobile, the controller calls `openMobileFileById` instead of `openTab`
- Single-trigger rule:
  - one pending-navigation cycle triggers native fallback only once even if multiple retry ticks happen before editor events arrive
- Early trigger rule:
  - native fallback fires before the old timeout budget is exhausted
- Non-trigger rule:
  - nearby missing blocks still use the current DOM retry path without native fallback
- Unsupported/failure rule:
  - if native fallback is unavailable or throws, navigation continues through the existing retry logic

### Integration-style store scenarios

- Native fallback followed by `loaded-protyle-dynamic`:
  - current match remains the same
  - context is refreshed
  - final `revealCurrentMatch` succeeds
- Native fallback followed by `switch-protyle`:
  - stale editor instance is replaced by the newly active one
  - highlight and current match state remain consistent
- Attribute-view result:
  - never calls native block navigation fallback

### Test harness updates

- Extend `tests/mocks/siyuan.ts` with:
  - `openTab`
  - `openMobileFileById`
- Add focused tests near:
  - `tests/store-context.test.ts`
  - or a dedicated pending-navigation/native-fallback suite if the setup becomes too large

## Assumptions

- The floating search panel remains mounted while the current Protyle instance is replaced or reloaded by native navigation.
- Replacing the current tab in place is acceptable as long as the user does not get a new tab and the search panel state is preserved.
- The native fallback only needs to support document block matches in v1.
- Existing i18n text for `navigationPending` is sufficient for the native-loading phase; no new locale strings are required initially.
