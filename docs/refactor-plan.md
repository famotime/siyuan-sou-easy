# Refactor Plan

## 1. Project Snapshot

- Generated on: 2026-03-19
- Scope: `siyuan-sou-easy` plugin codebase
- Goal: reduce orchestration complexity in search/replace state flow, shrink UI/controller coupling, and make future feature work safer without changing current behavior

## 2. Architecture and Module Analysis

| Module | Key Files | Current Responsibility | Main Pain Points | Test Coverage Status |
| --- | --- | --- | --- | --- |
| Plugin bootstrap and settings | `src/index.ts`, `src/settings.ts`, `src/features/search-replace/settings-panel.ts`, `src/main.ts` | Plugin lifecycle, command registration, settings loading/saving, panel mounting | `src/index.ts` is large for a bootstrap file and mixes lifecycle, hotkey capture, settings UI, and command syncing; settings metadata is split across multiple files | Good coverage via `tests/plugin-settings-panel.test.ts`, `tests/plugin-command-hotkeys.test.ts`, `tests/hotkey-setting-input.test.ts`, `tests/settings.test.ts`, `tests/plugin-editor-events.test.ts` |
| Search/replace orchestration | `src/features/search-replace/store.ts`, `src/features/search-replace/store/replacement.ts`, `src/features/search-replace/store/context-cache.ts`, `src/features/search-replace/store/document-snapshot.ts`, `src/features/search-replace/store/ui-state.ts` | Reactive state, editor event handling, refresh scheduling, selection scope caching, replacement flow, UI state persistence | `store.ts` is the main risk center at 585 lines; it mixes lifecycle, event listeners, cache invalidation, search refresh, panel behavior, and minimap triggers; cross-file invariants are implicit | Strong coverage via `tests/store-context.test.ts`, `tests/store-replace-all.test.ts`, `tests/live-refresh.test.ts`, `tests/store-ui-state.test.ts`, `tests/selection-mode-panel.test.ts` |
| Search engine and block model | `src/features/search-replace/search-engine.ts`, `src/features/search-replace/types.ts`, `src/features/search-replace/preserve-case.ts` | Pattern creation, match generation, case-preserving replacement transform, search types | Matching rules are compact but coupled to DOM-derived block data and replaceability checks from editor utilities; responsibilities are small but boundary naming can be clearer | Good focused coverage via `tests/search-engine.test.ts`, `tests/preserve-case.test.ts`, `tests/replacement-offset.test.ts` |
| Editor DOM adapters | `src/features/search-replace/editor/*.ts` | Resolve editor context, collect blocks, selection scope mapping, decorations, range location, DOM replacement support | Block traversal logic is duplicated across `blocks.ts`, `selection.ts`, and minimap-related code; ownership and selector rules are easy to drift over time | Moderate-to-good coverage via `tests/editor-block-collection.test.ts`, `tests/editor-context-detection.test.ts`, `tests/selection-scope.test.ts`, `tests/current-block-highlight.test.ts`, `tests/match-scroll.test.ts` |
| Panel UI and interaction composables | `src/App.vue`, `src/features/search-replace/ui/use-panel-frame.ts`, `src/features/search-replace/ui/use-panel-minimap.ts`, `src/features/search-replace/ui/use-composed-input.ts` | Render panel, wire toolbar actions, drag/resize behavior, minimap visualization, IME-safe inputs | `App.vue` is 438 lines and contains both render structure and controller logic; replace/search toolbar growth is making the component denser; minimap and frame logic are sizable and imperative | Good coverage via `tests/panel-widget.test.ts`, `tests/selection-mode-panel.test.ts`, `tests/minimap-widget.test.ts`, `tests/panel-i18n.test.ts`, `tests/ime-search-input.test.ts` |
| Kernel/API boundary | `src/features/search-replace/kernel.ts` | Wrap SiYuan kernel requests for doc loading and block updates | Small today, but error handling and request shapes are ad hoc; likely to grow as long-document support expands | Covered indirectly by store tests with mocks; no dedicated boundary tests |

## 3. Prioritized Refactor Backlog

| ID | Priority | Module/Scenario | Files in Scope | Refactor Objective | Risk Level | Pre-Refactor Test Checklist | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RF-001 | P0 | Search/replace orchestration split | `src/features/search-replace/store.ts`, `src/features/search-replace/store/replacement.ts`, `src/features/search-replace/store/context-cache.ts`, `src/features/search-replace/store/document-snapshot.ts`, related tests | Split `store.ts` into smaller units around panel commands, editor event listeners, and refresh/search coordination so state invariants become explicit and easier to test | High | - [x] Panel still searches after focus leaves editor; - [x] Selection-only mode keeps/clears scope correctly; - [x] Live refresh still updates without scrolling regressions; - [x] Full-document search still uses document snapshots; - [x] Replace current/all still work for unloaded blocks | done |
| RF-002 | P1 | Panel component decomposition | `src/App.vue`, possibly new toolbar/row subcomponents under `src/features/search-replace/ui/` or `src/components/`, related tests | Extract toolbar and replace-row controller/view concerns from `App.vue` to reduce coupling between rendering, focus management, and action dispatch | Medium | - [x] Replace row expand/collapse behavior stays identical; - [x] Selection-only and preserve-case toolbar buttons keep behavior; - [x] Regex help visibility unchanged; - [x] Drag/resize/minimap integration remains intact | done |
| RF-003 | P1 | Shared block traversal and selection helpers | `src/features/search-replace/editor/blocks.ts`, `src/features/search-replace/editor/selection.ts`, `src/features/search-replace/ui/use-panel-minimap.ts`, possibly `src/features/search-replace/editor/decorations.ts` | Consolidate repeated DOM traversal and block ownership rules into shared helpers to reduce selector drift and hidden inconsistencies between search, selection, and minimap | Medium | - [x] Searchable block collection unchanged for nested/table/list cases; - [x] Selection scope still maps text and block selections correctly; - [x] Minimap markers and current match mapping remain correct | done |
| RF-004 | P2 | Plugin settings and command wiring cleanup | `src/index.ts`, `src/settings.ts`, `src/features/search-replace/settings-panel.ts`, related tests | Reduce duplication in command registration and settings rendering so plugin bootstrap is easier to extend without touching multiple paths | Low | - [x] Hotkeys still register and sync correctly; - [x] Settings page still shows the same items in the same order; - [x] Top bar and editor callbacks still open the correct panel mode | done |

Priority definition:
- `P0`: highest value and risk, execute first
- `P1`: medium value or risk, execute after P0
- `P2`: low-risk cleanup, execute last

Status definition:
- `pending`
- `in_progress`
- `done`
- `blocked`

## 4. Execution Log

| ID | Start Date | End Date | Test Commands | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| RF-001 | 2026-03-19 | 2026-03-19 | `corepack pnpm test tests/store-context.test.ts tests/store-replace-all.test.ts tests/live-refresh.test.ts tests/selection-mode-panel.test.ts`; `corepack pnpm test` | pass | Extracted search runtime concerns from `store.ts` into `store/search-controller.ts` without changing public store API |
| RF-002 | 2026-03-19 | 2026-03-19 | `corepack pnpm test tests/panel-widget.test.ts tests/selection-mode-panel.test.ts tests/minimap-widget.test.ts tests/panel-i18n.test.ts`; `corepack pnpm test` | pass | Extracted panel rows and regex help into focused UI subcomponents while keeping existing panel interactions intact |
| RF-003 | 2026-03-19 | 2026-03-19 | `corepack pnpm test tests/editor-block-collection.test.ts tests/selection-scope.test.ts tests/minimap-widget.test.ts tests/current-block-highlight.test.ts tests/match-scroll.test.ts`; `corepack pnpm test` | pass | Unified block root resolution, unique block enumeration, and text-length helpers across search, selection, and minimap code |
| RF-004 | 2026-03-19 | 2026-03-19 | `corepack pnpm test tests/plugin-settings-panel.test.ts tests/plugin-command-hotkeys.test.ts tests/hotkey-setting-input.test.ts tests/settings.test.ts`; `corepack pnpm test` | pass | Moved panel command registration/sync and settings item rendering to dedicated helpers to make `index.ts` more data-driven |

## 5. Decision and Confirmation

- User approved items: `RF-001`, `RF-002`, `RF-003`, `RF-004`
- Deferred items: none
- Blocked items and reasons:

## 6. Next Actions

1. Optional follow-up: consider adding dedicated unit tests for the new helper modules if future changes start targeting them directly.
2. If more UI controls are added, keep routing them through the extracted panel row components instead of growing `App.vue` again.
3. If more kernel/document behaviors are added, extend the search controller rather than re-expanding `store.ts`.
