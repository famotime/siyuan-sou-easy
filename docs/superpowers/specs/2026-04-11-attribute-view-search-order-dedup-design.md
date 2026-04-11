# Attribute View Search Order And Dedup Design

## Context

The plugin currently searches attribute-view content through a DOM-first pipeline and falls back to `renderAttributeView` when needed.

For table-style attribute views, SiYuan can render one logical row across multiple DOM panes, such as a fixed pane plus a scrollable pane. In that layout, the current candidate collector walks DOM nodes in document order. That order does not necessarily match the visual left-to-right order the user sees. It can also collect multiple DOM copies of what is logically the same row or cell.

The reported symptom is a combined regression:

- search hit order for database blocks does not match the visual order
- search result count can include duplicated hits for the same logical cell
- navigation/highlighting can target the wrong DOM copy when the same logical row appears in multiple panes

The issue was reproduced against document `20240628135105-21if5ks`, whose content is a single `NodeAttributeView` block with AV id `20260329151045-ng396v7` and view id `20260329103438-yc0m9is`.

## Goal

Keep attribute-view search DOM-first, but make table/database results stable by logical row and logical column so that:

- result order matches the visual top-to-bottom, left-to-right order
- duplicated DOM copies do not inflate the hit count
- match navigation and highlighting resolve the same logical cell the result list refers to

## Non-Goals

- redesign the full attribute-view search architecture
- switch all attribute-view searching to API-first
- add new user settings
- change preview string format unless required by logical dedup

## Options Considered

### Option 1: DOM-first with row/cell normalization

Normalize table DOM into logical rows and logical columns before building candidates.

Pros:

- preserves the existing DOM-first behavior and existing fallback policy
- keeps visible DOM as the primary source of truth
- fixes ordering, dedup, and jump targeting in one model

Cons:

- requires new normalization logic for split panes

### Option 2: API-first ordering and dedup

Use `renderAttributeView` row/column data as the canonical order and only use DOM for locating cells.

Pros:

- strong logical model

Cons:

- more coupled to API payload shape
- more divergence risk when visible DOM and API output differ
- weaker fit with the current codebase design

### Option 3: Geometry-based ordering

Keep current DOM collection, then sort candidates by bounding box position.

Pros:

- visually intuitive

Cons:

- fragile in tests and hidden/inactive view cases
- does not solve logical dedup cleanly
- introduces runtime layout dependence into search assembly

## Decision

Adopt Option 1.

## Design

### 1. Normalize table DOM into logical rows

In `src/features/search-replace/attribute-view/search-dom-candidates.ts`, replace the current flat row-cell walk for table-like DOM with a logical row aggregation step:

- collect visible row containers as today
- group row containers by row identity:
  - prefer `data-id`
  - then `data-item-id`
  - then `data-row-id`
- treat all containers with the same identity as one logical row
- preserve visual row order by the first visible occurrence of each logical row

This collapses fixed-pane and scrollable-pane duplicates into one logical row.

### 2. Build a stable logical column order per attribute view

For each logical row group:

- collect all visible cells from all row fragments
- resolve each cell key using existing key-id extraction rules
- merge cells that represent the same logical column
- prefer keyed cells over fallback synthetic column ids when both exist

The logical column order should come from the header when available:

- use visible header cells as the primary global column order
- map header key ids to global column indices
- when a row cell has a known key id, assign its column index from that global order
- when a row cell has no stable key id, append it after known columns in the fragment order in which it first appears

This makes `columnIndex` represent the full table’s logical left-to-right order, not the local pane order.

### 3. Emit candidates in logical visual order

Candidate emission order becomes:

1. view title candidates in document order
2. column headers in logical left-to-right order
3. group titles in document order
4. row cell candidates by:
   - logical row order
   - logical column order within each row

This replaces the current final sort by raw DOM `compareDocumentPosition` for row cells.

### 4. Keep candidate dedup logical, not incidental

Existing merge logic in `search-candidate-policy.ts` already deduplicates some same-signature candidates. The DOM collector should reduce duplicates before they reach merge:

- same logical row + same logical column + same text => one candidate
- same row rendered in multiple panes must not produce multiple candidates

Rendered fallback merge behavior remains unchanged.

### 5. Align navigation/highlighting with the same logical model

In `src/features/search-replace/editor/attribute-view.ts`, update row/cell lookup so it resolves the target cell using the same logical row and logical column rules:

- group matching row DOM fragments by row identity
- assemble logical row cells across fragments
- select the cell by the match’s logical `columnIndex`
- if multiple physical DOM nodes map to the same logical cell, prefer the visible non-header element in the active pane

This ensures result list order, hit count, highlight target, and jump target all use one logical interpretation.

## Files Expected To Change

- `src/features/search-replace/attribute-view/search-dom-candidates.ts`
- `src/features/search-replace/editor/attribute-view.ts`
- `tests/attribute-view-search.test.ts`
- possibly a new focused test file if the normalization logic becomes large enough to isolate

## Testing Plan

Follow TDD:

1. add a failing test covering split-pane table DOM where one logical row is rendered across multiple fragments and duplicate text currently double-counts
2. add a failing test covering left-to-right visual order across fixed and scrollable panes
3. if needed, add a navigation-facing test that proves `columnIndex` resolves to the intended logical cell
4. implement the minimal normalization logic to make the tests pass
5. rerun the relevant Vitest suites

Primary verification target:

- `tests/attribute-view-search.test.ts`

Secondary regression checks if touched behavior requires them:

- `tests/store-context.test.ts`
- `tests/current-block-highlight.test.ts`

## Risks And Mitigations

### Risk: hidden inactive views leak into the logical row map

Mitigation:

- keep existing visibility filtering unchanged
- only normalize already-visible row fragments

### Risk: rows without stable ids cannot be merged safely

Mitigation:

- only merge row fragments when a stable row identity exists
- otherwise keep the current local fragment behavior

### Risk: synthetic fallback columns become unstable

Mitigation:

- only use synthetic ordering for cells without stable key ids
- anchor known columns to header-derived order first

## Acceptance Criteria

- database block search results no longer show duplicate hits caused by split-pane DOM clones
- next/previous result navigation follows the same order users see in the table
- AV hit highlighting/jump targets the logical cell associated with the selected result
- existing AV fallback behavior for non-table views remains unchanged
