# Project Structure

## Scope

- Repository: `siyuan-sou-easy`
- Last updated: `2026-03-29`
- Purpose: map the current module layout after refactors `RF-101` to `RF-105`

## Top Level

| Path | Responsibility |
| --- | --- |
| `src/` | Plugin source code, Vue UI, search/replace feature modules, editor adapters, settings, and i18n |
| `tests/` | Vitest coverage for plugin bootstrap, store behavior, editor DOM rules, UI widgets, search engine, and release checks |
| `docs/` | Maintenance docs, including the refactor plan and this structure map |
| `scripts/` | Release-readiness checks used by `pnpm precheck` |
| `reference_docs/` | SiYuan plugin development references kept outside the runtime bundle |
| `plugin-sample-vite-vue/` | Upstream development template kept for comparison/reference |
| `assets/`, `icon.png`, `preview.png` | Screenshots and plugin visual assets |
| `dist/`, `package.zip` | Build output and packaged artifact |

## Runtime Entry Points

| Path | Responsibility |
| --- | --- |
| `src/index.ts` | SiYuan plugin class: environment detection, top bar registration, command registration, settings panel wiring, and editor event binding |
| `src/main.ts` | Mounts and unmounts the Vue application host, binds store lifecycle to the plugin instance |
| `src/App.vue` | Search/replace panel shell and composition of panel widgets |
| `src/plugin-instance.ts` | Shared access to the current plugin instance |
| `src/settings.ts` | Settings schema, normalization, persistence, and defaults |
| `src/hotkeys.ts` | Hotkey normalization, formatting, and conflict detection helpers |

## Feature Module: `src/features/search-replace/`

### Orchestration

| Path | Responsibility |
| --- | --- |
| `store.ts` | Public facade used by the Vue app and plugin bootstrap; coordinates state, refresh, navigation, and replace actions |
| `types.ts` | Cross-module search, editor, match, and attribute-view types |
| `kernel.ts` | SiYuan kernel API bridge for block DOM fetch/update operations |
| `search-engine.ts` | Query matching, regex handling, and match list generation |
| `match-utils.ts` | Shared match helpers |
| `debug.ts` | Optional debug logging hooks |

### Store Submodules

| Path | Responsibility |
| --- | --- |
| `store/state.ts` | Reactive search/replace UI state |
| `store/ui-state.ts` | Persisted panel position and UI preferences |
| `store/context-cache.ts` | Active editor context and selection-scope caching |
| `store/document-snapshot.ts` | Cached document content snapshots and invalidation |
| `store/replacement.ts` | Replace current / replace all workflows |
| `store/search-controller.ts` | Search refresh orchestration and current-match reveal flow |
| `store/search-document-events.ts` | Document listener binding and mutation-triggered refresh decisions |
| `store/search-pending-navigation.ts` | Deferred navigation retry logic after editor/doc changes |
| `store/search-blocks.ts` | Searchable block resolution from live DOM and snapshot fallbacks |

### Attribute View Search

| Path | Responsibility |
| --- | --- |
| `attribute-view-search.ts` | High-level attribute-view search pipeline and match assembly |
| `attribute-view/search-blocks.ts` | Attribute-view block discovery and AV/view id resolution |
| `attribute-view/search-candidates.ts` | Candidate collection from DOM and rendered API payloads |
| `attribute-view/search-values.ts` | Value normalization for relation, rollup, date, number, and asset-like fields |
| `attribute-view/search-types.ts` | Attribute-view specific types and constants |

### Editor Adapters

| Path | Responsibility |
| --- | --- |
| `editor.ts` | Barrel exports for editor-facing helpers |
| `editor/context.ts` | Active editor resolution and `EditorContext` construction |
| `editor/blocks.ts` | Searchable block collection, block text extraction, and table-aware metadata assembly |
| `editor/selection.ts` | Current selection text and selection-scope extraction |
| `editor/ranges.ts` | Locate DOM ranges for match highlighting and replacement |
| `editor/decorations.ts` | CSS highlight syncing, block/cell decoration, and scroll-into-view behavior |
| `editor/replacement.ts` | Apply replacements against DOM clones and validate editable ranges |
| `editor/attribute-view.ts` | Attribute-view cell lookup helpers for highlighting |
| `editor/table-dom.ts` | Shared table row / cell resolution for native and custom table DOM shapes |
| `editor/scroll-container.ts` | Shared editor scroll container discovery and container scrolling helpers |
| `editor/constants.ts` | Editor and decoration constants |

### Plugin Bootstrap Helpers

| Path | Responsibility |
| --- | --- |
| `plugin-command-config.ts` | Command descriptors and hotkey synchronization |
| `plugin-events.ts` | Editor-related event bus subscriptions |
| `plugin-environment.ts` | Frontend environment detection |
| `plugin-panel-launch.ts` | Panel open/toggle behavior from commands and keyboard events |
| `plugin-setting-elements.ts` | DOM helpers for settings panel controls |
| `plugin-settings-ui.ts` | Settings panel registration and setting-row composition |
| `settings-panel.ts` | Setting-key types and settings panel contracts |

### UI Composables and Components

| Path | Responsibility |
| --- | --- |
| `ui/use-panel-frame.ts` | Dragging, resizing, and position persistence for the panel |
| `ui/use-panel-minimap.ts` | Minimap composable that combines store data with layout helpers |
| `ui/minimap-layout.ts` | Pure layout helpers for minimap geometry, viewport projection, and click-to-scroll calculations |
| `ui/use-composed-input.ts` | IME-aware input behavior |
| `ui/SearchToolbarRow.vue`, `ui/ReplaceActionRow.vue`, `ui/RegexHelpPanel.vue` | Panel UI pieces used by `App.vue` |

## Shared UI and Localization

| Path | Responsibility |
| --- | --- |
| `src/components/SiyuanTheme/` | Theme-aligned Vue primitives such as buttons, inputs, selects, checkboxes, icons, and textarea |
| `src/i18n/en_US.json`, `src/i18n/zh_CN.json` | Locale strings |
| `src/i18n/runtime.ts` | Runtime locale selection helpers |
| `src/icons.ts` | Top bar icon registration payload |

## Test Layout

| Area | Representative files |
| --- | --- |
| Plugin bootstrap and settings | `tests/plugin-command-hotkeys.test.ts`, `tests/plugin-settings-panel.test.ts`, `tests/plugin-panel-launch.test.ts`, `tests/plugin-editor-events.test.ts` |
| Store refresh and replacement | `tests/store-context.test.ts`, `tests/live-refresh.test.ts`, `tests/store-replace-all.test.ts`, `tests/store-ui-state.test.ts` |
| Attribute-view search | `tests/attribute-view-search.test.ts` |
| Editor DOM rules and highlighting | `tests/editor-block-collection.test.ts`, `tests/editor-table-dom.test.ts`, `tests/selection-scope.test.ts`, `tests/current-block-highlight.test.ts`, `tests/match-scroll.test.ts` |
| UI behavior | `tests/minimap-layout.test.ts`, `tests/minimap-widget.test.ts`, `tests/panel-widget.test.ts`, `tests/panel-i18n.test.ts`, `tests/ime-search-input.test.ts` |
| Cross-cutting utilities and release checks | `tests/search-engine.test.ts`, `tests/preserve-case.test.ts`, `tests/release-precheck.test.ts`, `tests/debug.test.ts` |

## Refactor Notes

- `RF-101` split search controller concerns into document events, pending navigation, and block resolution helpers.
- `RF-102` separated attribute-view block discovery, candidate assembly, and value normalization.
- `RF-103` extracted pure minimap layout helpers from the UI composable.
- `RF-104` reduced `src/index.ts` responsibility by moving environment, panel launch, and settings element helpers out.
- `RF-105` aligned editor table DOM rules and scroll container resolution through shared helpers used by block collection and decorations.
