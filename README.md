# Friendly Search Replace

A SiYuan plugin that brings a VS Code style find-and-replace workflow to the current document.

## Features

- Search within the active document
- Previous / next navigation with current match count
- Match case, whole word, and regular expression modes
- Search and replace inside the current selection
- Replace current, skip current, and replace all actions
- Preserve the casing pattern of the current match during replacement
- Top bar entry, command palette entry, and configurable hotkeys
- Draggable, resizable panel with remembered position
- Document minimap with live match synchronization
- IME composition handling, document switch fallback, and live refresh in the editor

## Current Scope

- Works on the currently active document only
- Uses the current editor DOM for search and navigation
- In complex rich-text structures, some matches can be searched but not directly replaced yet

## Project Docs

- Structure doc: `docs/project-structure.md`
- Product doc: `docs/PRD.md`
- Development plan: `docs/development-plan.md`
- Manual validation checklist: `docs/manual-validation-checklist.md`

## Source Entry Points

- Plugin entry: `src/index.ts`
- State orchestration: `src/features/search-replace/store.ts`
- Editor DOM adapter: `src/features/search-replace/editor.ts`
- UI template: `src/App.vue`

## Development

```bash
corepack pnpm install
corepack pnpm test
corepack pnpm precheck
corepack pnpm build
```

If `.env` contains `VITE_SIYUAN_WORKSPACE_PATH`, you can also run:

```bash
corepack pnpm dev
```

## Testing

- Test runner: Vitest
- Regression coverage: plugin entry and settings, store orchestration, editor DOM adaptation, panel interaction, and minimap
- Common commands:

```bash
corepack pnpm exec vitest run tests/store-context.test.ts
corepack pnpm exec vitest run tests/panel-widget.test.ts tests/minimap-widget.test.ts
```
