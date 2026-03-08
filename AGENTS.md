# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the plugin code. Core search/replace logic lives in `src/features/search-replace/`, shared UI primitives live in `src/components/SiyuanTheme/`, and locale files live in `src/i18n/`. Main entry points are `src/index.ts`, `src/main.ts`, and `src/App.vue`. Tests live in `tests/` with SiYuan mocks in `tests/mocks/`. Project docs are in `docs/`, release checks in `scripts/`, and static assets in `asset/`, `icon.png`, and `preview.png`. Build output goes to `dist/` and `package.zip`.

## Build, Test, and Development Commands
- `pnpm install` — install dependencies; CI uses pnpm on Node 18.
- `pnpm dev` — run Vite in watch mode and rebuild plugin files during development.
- `pnpm build` — create the production bundle and packaged artifact.
- `pnpm test` — run all Vitest suites in `tests/**/*.test.ts`.
- `pnpm test:watch` — rerun tests interactively while editing.
- `pnpm precheck` — verify release readiness, including version sync and i18n/readme consistency.
- `node release.js --mode=patch|minor|major|manual` — prepare a release version update.

## Coding Style & Naming Conventions
Use TypeScript, Vue 3, and ESM-style imports. Follow `.editorconfig`: 2-space indentation, UTF-8, and final newlines. Prefer single quotes and trailing commas in multiline structures, matching `eslint.config.mjs`. Keep Vue components in PascalCase (`SyButton.vue`) and TypeScript modules in descriptive kebab-case (`search-engine.ts`). Use the `@/` alias for imports under `src/`. There is no dedicated lint script yet, so keep changes aligned with the existing ESLint rules.

## Testing Guidelines
Vitest is the test runner, configured for a Node environment in `vitest.config.ts`. Name new tests `*.test.ts` and place them in `tests/`. Add focused coverage for behavior changes in search flow, settings, hotkeys, release checks, and state management. Reuse `tests/mocks/siyuan.ts` when code touches the SiYuan API.

## Commit & Pull Request Guidelines
Recent history follows Conventional Commit style, especially `feat:` (for example, `feat: add configurable settings panel`). Prefer `feat:`, `fix:`, `docs:`, `test:`, or `refactor:` with a short imperative summary. PRs should explain the user-visible change, link related issues or planning docs, list verification commands run, and include screenshots or GIFs for UI changes.

## Release & Configuration Tips
Keep `package.json` and `plugin.json` versions aligned. When adding strings, update both `src/i18n/en_US.json` and `src/i18n/zh_CN.json`. If README filenames or locales change, make sure `plugin.json.readme` still points to existing top-level files.
