# Long Document Search Navigation Summary

## Scope

- Date: `2026-04-05`
- Plugin: `siyuan-sou-easy`
- Repro document: `20251208094107-ztk4cwm`
- Repro keyword: `Definition`

## Problem Symptoms

- In long documents, the search result counter can advance from `3/5` to `4/5` and `5/5`, but the viewport remains on the previous hit.
- The issue is not limited to one direction. Depending on the current viewport position, both forward and backward navigation can fail.
- The failure is intermittent with respect to the current lazy-loaded editor region, which indicates the problem is tied to rendering state rather than result indexing alone.
- Typical live logs showed that the target match ID and block index had already changed, while the visible editor position stayed unchanged.

## What Was Confirmed Early

- The problem is not that the match counter fails to update.
- The search state does switch to the requested match.
- The failure happens later in the chain:
  - matching block resolution
  - range resolution
  - scroll visibility confirmation
  - lazy-load retry navigation
  - editor instance / scroll container selection

## Key Live Signals

- `pending-navigation:approximate-scroll` showed:
  - `blockIndex: 282`
  - `loadedBlockRange.max: 76`
  - `nextScrollTop: 19912`
  - `currentScrollTop: 9498`
- Earlier logs showed repeated retries ending in:
  - `pending-navigation:clear { reason: 'stalled-timeout' }`
  - later `pending-navigation:clear { reason: 'lower-boundary-timeout' }`
- Later instrumentation showed cases where:
  - `appliedScrollTop` reached the target value
  - but the visible viewport still did not move to the new hit
- The absence of `scroll-container:resolved` logs in live runs implied that the failing path was not always "multiple `.protyle-content` candidates inside the same editor".

## Root Cause Breakdown

The issue turned out to be a compound problem rather than a single bug.

### 1. Wrong block element could be selected

- Duplicate `data-node-id` elements can exist in the DOM.
- Some candidates are metadata or hidden nodes, not the actual renderable editor block.
- If navigation resolves the wrong node, the match is treated as present while no visible jump occurs.

### 2. Match offsets can drift from live text nodes

- After editor rendering or content normalization, stored text offsets can stop matching the exact live range.
- This breaks precise range lookup even when the block is correct.

### 3. "Scrolled" did not always mean "visible"

- Direct scroll attempts could report success while the target match was still not visible.
- Pending navigation originally stopped too early in these cases.

### 4. Lazy-load retry logic stalled at document boundaries

- For far-away hits, the plugin must keep pushing the viewport toward the lazy-load boundary until the target block is rendered.
- The early retry logic could time out even when progress was still possible.
- Upward and downward boundary waiting needed to be treated separately.

### 5. Visible loaded range could be computed incorrectly

- Sparse loaded blocks outside the current viewport distorted the approximate navigation range.
- This caused the algorithm to estimate the target as closer than it really was.

### 6. `scrollTo` could exist but still be ineffective in live SiYuan

- Some containers reported dimensions and accepted `scrollTo`, but the visible viewport did not actually move.
- A direct `scrollTop` fallback was needed even when `scrollTo` existed.

### 7. The chosen scroll container could be correct locally but still belong to the wrong editor instance

- During transition states, multiple editor instances with the same `rootId` can coexist.
- If the cached or re-resolved `EditorContext` points to a stale `.protyle`, all later scrolling happens inside the wrong editor tree.
- This explains cases where container-level values changed in logs but the user still saw no jump.

## Investigation Strategy

The debugging approach was to trace the full navigation chain and isolate where state and viewport diverged.

### Step 1. Confirm state vs. viewport

- Verify whether the current match index changed.
- Confirm that the failure was "state updated, viewport did not follow".

### Step 2. Check whether the target block was renderable

- Instrument `getBlockElement`.
- Distinguish between:
  - block truly missing from the rendered DOM
  - wrong DOM candidate selected
  - hidden or non-renderable candidate selected

### Step 3. Check whether the text range was still valid

- Instrument precise match range lookup.
- Add a nearest-text fallback when raw offsets no longer lined up with the live DOM.

### Step 4. Separate direct scroll from actual visibility

- Treat "scrolled" and "visible" as different states.
- Keep pending navigation active until the current match is genuinely visible.

### Step 5. Inspect lazy-load boundary behavior

- Log approximate navigation state on every retry:
  - current loaded block range
  - target block index
  - computed next scroll position
  - active container
- Distinguish between:
  - generic stall
  - waiting at upper lazy-load boundary
  - waiting at lower lazy-load boundary

### Step 6. Verify the real scroll host

- Check whether the selected container actually changes position after `scrollTo`.
- If not, try:
  - direct `scrollTop`
  - scrollable ancestors
  - document scrolling element when relevant

### Step 7. Verify the editor instance itself

- If container selection still looked correct, inspect whether the plugin had resolved the wrong `.protyle`.
- Add preference rules so that duplicate editor instances with the same `rootId` prefer the visible, active-window instance.

## Attempted Measures And Progress

The following steps were tried in sequence. Each step either eliminated a class of false positives or narrowed the problem to a smaller part of the pipeline.

### 1. Confirm whether navigation state was wrong

- Observation:
  - the counter changed from `3/5` to `4/5` and `5/5`
  - the viewport stayed on the old result
- Progress:
  - confirmed that search state was advancing correctly
  - ruled out a simple "next/previous index update" bug

### 2. Add logs around block resolution

- Action:
  - instrumented `getBlockElement`
  - logged all matching DOM candidates and the chosen one
- Observation:
  - some node IDs could resolve to hidden or non-renderable candidates
- Progress:
  - identified that "same block ID exists in DOM" did not guarantee "correct visible block resolved"

### 3. Tighten block candidate selection

- Action:
  - changed block resolution to prefer renderable, non-hidden, viewport-nearest candidates
- Observation:
  - removed metadata-only false positives
- Progress:
  - reduced one source of navigation failure
  - navigation still failed in long-document lazy-load scenarios, so the root cause was not fully resolved

### 4. Add logs around range lookup and match visibility

- Action:
  - instrumented precise range resolution and visibility checks
  - separated "scroll called" from "match visible"
- Observation:
  - range lookup could fail even when the block was present
  - some scroll attempts reported success while the hit was still not visible
- Progress:
  - proved that "scroll result = scrolled" was not a sufficient success condition

### 5. Add fallback range matching for text offset drift

- Action:
  - when stored offsets no longer matched the live DOM, fall back to locating the nearest `matchedText`
- Observation:
  - improved recovery for DOM normalization and offset drift cases
- Progress:
  - eliminated another source of false "missing" matches
  - long-distance navigation failures still remained

### 6. Keep pending navigation alive until the hit is truly visible

- Action:
  - pending navigation now continues not only on `missing`, but also when the match is still not visible after scrolling
- Observation:
  - some previously "successful" navigations were actually stopping too early
- Progress:
  - prevented premature termination of the retry loop

### 7. Inspect retry loop stall behavior

- Action:
  - instrumented retry count, loaded range, target block index, and timeout reason
- Observation:
  - retries could end with `stalled-timeout` even though lazy-load progress should still have been possible
- Progress:
  - confirmed that the timeout policy itself was too coarse

### 8. Split upper-boundary and lower-boundary waiting

- Action:
  - handled upward and downward lazy-load waiting as separate cases
- Observation:
  - backward navigation and forward navigation failed for different reasons near opposite document boundaries
- Progress:
  - fixed symmetric retry logic assumptions
  - reduced cases where navigation stopped just because the current boundary had not advanced yet

### 9. Recompute the loaded block range from the visible segment

- Action:
  - stopped using sparse offscreen loaded blocks to estimate the approximate navigation range
  - used the centered visible loaded segment instead
- Observation:
  - previously, far-away loaded blocks could distort the estimated target position
- Progress:
  - made long-distance approximate scrolling more stable

### 10. Inspect approximate scrolling itself

- Action:
  - logged `currentScrollTop`, `nextScrollTop`, `maxScrollTop`, `loadedBlockRange`, and active container
- Observation:
  - live logs showed `nextScrollTop` reaching the bottom, while `currentScrollTop` did not move
- Progress:
  - narrowed the problem from lazy-load math to actual scroll application

### 11. Add fallback from `scrollTo` to direct `scrollTop`

- Action:
  - after calling `scrollTo`, verify whether the container position actually changed
  - if not, force `scrollTop`
- Observation:
  - some live containers exposed `scrollTo` but did not actually move the visible region
- Progress:
  - fixed the class of failures where `scrollTo` existed but was ineffective

### 12. Add fallback to scrollable ancestor containers

- Action:
  - when the primary container still did not move, try scrollable ancestor hosts
- Observation:
  - some layouts can keep the real vertical scrolling on a parent container instead of `.protyle-content`
- Progress:
  - covered the "wrong scroll host" branch
  - still not enough to explain all live failures

### 13. Test whether multiple `.protyle-content` nodes existed in the same editor

- Action:
  - added selection logic and logging for multiple `.protyle-content` candidates
- Observation:
  - in local tests, transition states could indeed choose the wrong content container
  - in live logs, `scroll-container:resolved` did not always appear
- Progress:
  - fixed one real branch, but also learned that the live failure was often higher-level than container choice alone

### 14. Move investigation up to `EditorContext`

- Action:
  - examined whether the plugin could be scrolling inside a stale `.protyle` instance with the same `rootId`
- Observation:
  - duplicate editor instances during transitions can share the same root ID
  - if the wrong `.protyle` is cached or reconnected, all later navigation operates in the wrong DOM tree
- Progress:
  - identified a higher-level failure mode that explains why container values could change in logs while the user saw no viewport jump

### 15. Prefer the visible editor instance for duplicate `rootId`s

- Action:
  - changed context collection and re-resolution to prefer the `.protyle` instance that is visible, nearer the viewport center, and more likely to belong to the active window
  - added `editor-context:deduped` logs
- Observation:
  - local regression tests confirmed that duplicate editor instances had previously selected the stale one
- Progress:
  - fixed the stale-editor-instance branch
  - significantly narrowed the remaining uncertainty to cases that do not involve duplicate visible editor trees

### 16. Keep regression tests aligned with every discovered branch

- Action:
  - added tests for:
    - wrong block candidate selection
    - offset drift
    - stale visibility after scroll
    - upper and lower lazy-load boundary waiting
    - ineffective `scrollTo`
    - ancestor scroll fallback
    - multiple `.protyle-content` candidates
    - duplicate `.protyle` instances with the same `rootId`
- Progress:
  - each newly discovered branch became reproducible in automated tests
  - this prevented later fixes from reintroducing already-resolved failure modes

## Fixes Implemented During Investigation

- Prefer renderable, viewport-nearest block elements when duplicate node IDs exist.
- Add fallback text matching when live range offsets drift.
- Keep pending navigation alive until the target match is actually visible.
- Separate upper-boundary and lower-boundary lazy-load waiting behavior.
- Base approximate navigation on the centered visible loaded segment instead of sparse offscreen blocks.
- Fall back from `scrollTo` to direct `scrollTop` when needed.
- Fall back to scrollable ancestor containers if the primary container does not move.
- Prefer the visible `.protyle-content` when multiple candidates exist.
- Prefer the visible editor instance when duplicate `.protyle` instances share the same `rootId`.

## Current Understanding

- The long-document navigation bug is fundamentally a synchronization problem across search state, lazy rendering, DOM duplication during transitions, and scroll host selection.
- The visible symptom is simple, but the real failure point can shift depending on the current editor state.
- The most reliable way to debug this class of issue is to keep state progression, DOM resolution, and viewport movement separately observable in logs.

## Useful Debug Logs

- `get-block-element:resolved`
- `match-scroll-state:unrenderable`
- `match-scroll:missing`
- `match-visible:false`
- `pending-navigation:direct-scroll`
- `pending-navigation:approximate-scroll`
- `pending-navigation:clear`
- `scroll-container:resolved`
- `editor-context:deduped`
