# Friendly Search Replace

**English** · [简体中文](README_zh_CN.md)

A SiYuan plugin that brings a VS Code style find-and-replace workflow to the current document.

## Features

- Search within the active document.
- Previous / next navigation with current match count.
- Match case, whole word, and regular expression modes.
- Search and replace inside the current selection.
- Replace current, skip current, and replace all actions.
- Preserve the casing pattern of the current match during replacement.
- Search attribute-view content in read-only preview form.
- Top bar entry, command palette entry, and configurable hotkeys.
- Draggable, resizable panel with remembered position.
- Document minimap with live match synchronization.

![Plugin preview](preview.png)

## Development

```bash
pnpm install
pnpm dev
pnpm test
pnpm build
```

Additional commands:

- `pnpm test:watch` runs Vitest in watch mode.
- `pnpm precheck` verifies release readiness and documentation consistency.
- `node release.js --mode=patch|minor|major|manual` updates release metadata.

## Project Layout

- `src/index.ts`, `src/main.ts`, `src/App.vue`: plugin bootstrap and panel host.
- `src/features/search-replace/store/`: search session lifecycle, cached context, refresh orchestration, and replacement flow.
- `src/features/search-replace/attribute-view/`: attribute-view block discovery, candidate extraction, and value normalization.
- `src/features/search-replace/editor/`: editor DOM adapters, highlighting, scrolling, selection scope, and replacement helpers.
- `src/features/search-replace/ui/`: panel composables and minimap layout logic.
- `tests/`: Vitest coverage for plugin bootstrap, store behavior, editor DOM rules, UI widgets, and release checks.

For a fuller module map, see [docs/project-structure.md](docs/project-structure.md).

## Verification

Current refactor baseline:

- `corepack pnpm test`

The repository currently keeps refactor tracking in [docs/refactor-plan.md](docs/refactor-plan.md).
