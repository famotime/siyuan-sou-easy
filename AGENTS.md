# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the plugin source. Runtime entry points are `src/index.ts`, `src/main.ts`, `src/App.vue`, and `src/index.scss`. Core search/replace logic lives in `src/features/search-replace/`: use `store/` for session orchestration, `attribute-view/` for attribute-view discovery and value normalization, `editor/` for DOM adapters/highlighting/replacement helpers, and `ui/` for panel composables and panel subcomponents. Keep plugin bootstrap helpers such as command registration, settings UI wiring, and environment detection in the top level of that feature folder rather than pushing them back into `src/index.ts`.

Shared UI primitives live in `src/components/SiyuanTheme/`. Cross-cutting settings and hotkey helpers live at the top of `src/`, reusable utilities live in `src/utils/`, and ambient type declarations live in `src/types/`. Locale files live in `src/i18n/`; when adding strings, update both `src/i18n/en_US.json` and `src/i18n/zh_CN.json`.

Tests live in `tests/` with SiYuan mocks in `tests/mocks/`. Project docs live in `docs/`; treat `docs/project-structure.md` as the current module map, `docs/refactor-plan.md` as the refactor execution record, and `docs/long-document-search-navigation-summary.md` as focused design context for long-document navigation behavior. Development references live in `reference_docs/`, the upstream template lives in `plugin-sample-vite-vue/`, release checks live in `scripts/`, and static assets live in `assets/`, `icon.png`, and `preview.png`. Generated output goes to `dist/` and `package.zip` and should not be edited manually.

## Build, Test, and Development Commands
- `pnpm install` - install dependencies; CI uses pnpm on Node 18.
- `pnpm dev` - run Vite in watch mode and rebuild plugin files during development.
- `pnpm build` - create the production bundle and packaged artifact.
- `pnpm test` - run all Vitest suites.
- `pnpm test:watch` - rerun tests interactively while editing.
- `pnpm precheck` - verify release readiness, including version sync and i18n/readme consistency.
- `pnpm release:patch` / `pnpm release:minor` / `pnpm release:major` - run the version bump workflow through `release.js`.
- `pnpm release:manual` - run the manual release mode.

## Coding Style & Naming Conventions
Use TypeScript, Vue 3, and ESM-style imports. Follow `.editorconfig`: 2-space indentation, UTF-8, and final newlines. Prefer single quotes and trailing commas in multiline structures, matching `eslint.config.mjs`. Keep Vue components in PascalCase such as `SyButton.vue` and TypeScript modules in descriptive kebab-case such as `search-engine.ts`. Use the `@/` alias for imports under `src/`.

Prefer extending the existing feature split instead of adding more mixed-responsibility files. New search orchestration belongs under `src/features/search-replace/store/`, editor DOM behavior under `src/features/search-replace/editor/`, attribute-view behavior under `src/features/search-replace/attribute-view/`, and shared pure helpers near their owning feature. There is no dedicated lint script yet, so keep changes aligned with the existing ESLint configuration.

## Testing Guidelines
Vitest is the test runner, configured for a Node environment in `vitest.config.ts`. Name new tests `*.test.ts` and place them in `tests/`. Add focused coverage for the behavior you change, especially around search refresh, replacement offsets, settings and hotkeys, panel UI behavior, editor range/highlight behavior, attribute-view search, and release checks. Reuse `tests/mocks/siyuan.ts` whenever code touches the SiYuan API.

When fixing regressions, prefer adding or updating a narrow test near the affected area first. Existing suites already cover plugin bootstrap, top-bar/command wiring, settings normalization, selection scope, long-document navigation, minimap layout, highlight styling, and replacement edge cases; extend those suites when the behavior is related instead of creating redundant coverage.

## Commit & Pull Request Guidelines
Recent history follows Conventional Commit style for normal development changes, with occasional version-tag commits during releases. Prefer `feat:`, `fix:`, `docs:`, `test:`, or `refactor:` with a short imperative summary. PRs should explain the user-visible change, link related issues or planning docs, list verification commands run, and include screenshots or GIFs for UI changes.

## Release & Configuration Tips
Keep `package.json` and `plugin.json` versions aligned. If README filenames or locales change, make sure `plugin.json.readme` still points to existing top-level files. Use `pnpm precheck` before cutting releases so the version metadata, README targets, and locale files stay in sync. Keep generated artifacts out of hand-edited changes unless the task explicitly requires a build output refresh.
