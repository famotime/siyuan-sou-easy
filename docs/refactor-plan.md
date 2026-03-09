# 重构计划

## 1. 项目快照

- 生成日期：2026-03-09
- 范围：`siyuan-sou-easy` 仓库，重点关注当前文档查找替换主流程
- 目标：在不改变用户可见行为的前提下，拆分高耦合模块，降低搜索面板、编辑器上下文和 DOM 映射逻辑的维护成本，并为后续功能迭代补齐更清晰的边界
- 文档刷新目标：`docs/project-structure.md`、`README.md`
- 基线状态：`pnpm test` 已通过，23 个测试文件 / 65 个测试全部通过
- 当前非计划内变更：`AGENTS.md` 已存在未提交修改，重构过程中不纳入本计划范围

## 2. 架构与模块分析

| 模块 | 关键文件 | 当前职责 | 主要痛点 | 测试覆盖情况 |
| --- | --- | --- | --- | --- |
| 插件入口与设置 | `src/index.ts`、`src/main.ts`、`src/settings.ts`、`src/hotkeys.ts` | 插件生命周期、顶栏入口、命令注册、设置面板、快捷键冲突检测、设置读写 | `src/index.ts` 同时处理生命周期、设置 UI、快捷键同步，`openSetting()` 存在重复配置代码；入口层与设置层边界不够清晰 | 有 `tests/plugin-editor-events.test.ts`、`tests/plugin-settings-panel.test.ts`、`tests/hotkey-setting-input.test.ts`、`tests/topbar-icon.test.ts`、`tests/settings.test.ts`、`tests/hotkeys.test.ts` |
| 搜索状态编排 | `src/features/search-replace/store.ts` | 维护响应式状态、面板开关、上下文缓存、选区缓存、DOM 监听、替换执行、UI 状态持久化 | 单文件 600+ 行，混合状态、事件监听、替换流程、观察器、持久化；行为耦合高，回归面广 | 有 `tests/store-context.test.ts`、`tests/live-refresh.test.ts`、`tests/selection-mode-panel.test.ts`；对 `replaceAll()`、UI 状态持久化、解绑清理覆盖不足 |
| 编辑器 DOM 适配 | `src/features/search-replace/editor.ts` | 编辑器上下文识别、块采集、选区范围换算、预览构造、高亮同步、替换偏移映射 | 上下文解析、文本节点遍历、高亮和替换映射全部聚合在一个文件，隐藏依赖多，不利于局部修改 | 有 `tests/editor-context-detection.test.ts`、`tests/selection-scope.test.ts`、`tests/replacement-offset.test.ts`、`tests/current-block-highlight.test.ts`、`tests/match-scroll.test.ts`；块采集白名单与 code block 开关缺少更聚焦测试 |
| 搜索面板与缩略图 UI | `src/App.vue` | 查找替换面板模板、IME 输入处理、拖拽/缩放、状态展示、文档 minimap 计算与交互 | 单个 SFC 900+ 行，模板、面板交互、minimap 几何计算和 watch 副作用耦合在一起，理解和复用成本高 | 有 `tests/panel-widget.test.ts`、`tests/minimap-widget.test.ts`、`tests/selection-mode-panel.test.ts`、`tests/ime-search-input.test.ts`；缺少关闭/卸载清理、窗口 resize 行为的定向测试 |
| 纯搜索逻辑与替换辅助 | `src/features/search-replace/search-engine.ts`、`src/features/search-replace/preserve-case.ts`、`src/features/search-replace/kernel.ts` | 模式匹配、whole-word/selection-only 过滤、保留大小写、内核 API 封装 | 文件本身不大，但与 DOM 适配和 store 编排的边界还可以更明确 | 有 `tests/search-engine.test.ts`、`tests/preserve-case.test.ts`；当前基线充足，可作为其它模块重构时的行为护栏 |

## 3. 按优先级排序的重构待办

| ID | 优先级 | 模块/场景 | 涉及文件 | 重构目标 | 风险等级 | 重构前测试清单 | 文档影响 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RF-001 | P0 | 拆分搜索状态编排与替换执行 | `src/features/search-replace/store.ts`，新增 `src/features/search-replace/store/state.ts`、`context-cache.ts`、`ui-state.ts`、`replacement.ts` | 将状态容器、编辑器上下文解析、选区缓存、替换执行、UI 状态持久化拆分为可单测的职责单元，同时保持公开 store API 不变 | 高 | - [x] `pnpm exec vitest run tests/store-context.test.ts tests/live-refresh.test.ts tests/selection-mode-panel.test.ts tests/store-replace-all.test.ts tests/store-ui-state.test.ts`；- [x] 新增针对 `replaceAll()` / UI 状态持久化 / 解绑清理的定向测试；- [x] `pnpm test` | `docs/project-structure.md`：新增 store 子模块职责图；`README.md`：如开发结构说明变化则同步 | done |
| RF-002 | P1 | 拆分搜索面板交互与 minimap 计算 | `src/App.vue`，新增 `src/features/search-replace/ui/use-composed-input.ts`、`use-panel-frame.ts`、`use-panel-minimap.ts`、`regex-help.ts` | 把拖拽/缩放、IME 输入、minimap 布局计算和静态正则帮助配置从 SFC 主体中拆出，降低模板和几何逻辑耦合度 | 中 | - [x] `pnpm exec vitest run tests/panel-widget.test.ts tests/minimap-widget.test.ts tests/selection-mode-panel.test.ts tests/ime-search-input.test.ts`；- [x] 新增关闭/卸载清理、viewport resize 行为测试；- [x] `pnpm test` | `docs/project-structure.md`：记录 UI/composable 拆分；`README.md`：如界面结构或开发说明变化则同步 | done |
| RF-003 | P1 | 拆分编辑器 DOM 适配层 | `src/features/search-replace/editor.ts`，新增 `src/features/search-replace/editor/*.ts` 子模块 | 将上下文检测、块采集、文本节点偏移映射、高亮逻辑分层，减少单文件内的 DOM 细节耦合 | 中 | - [x] `pnpm exec vitest run tests/editor-block-collection.test.ts tests/editor-context-detection.test.ts tests/selection-scope.test.ts tests/replacement-offset.test.ts tests/current-block-highlight.test.ts tests/match-scroll.test.ts`；- [x] 补充 block collection 定向测试；- [x] `pnpm test` | `docs/project-structure.md`：补充 editor 适配层分层；`README.md`：通常仅小幅同步开发结构说明 | done |
| RF-004 | P2 | 清理插件入口与设置面板声明 | `src/index.ts`、新增 `src/features/search-replace/settings-panel.ts`、`plugin-events.ts` | 抽离重复的设置项配置和命令/事件注册辅助函数，让入口层聚焦生命周期编排 | 低 | - [x] `pnpm exec vitest run tests/plugin-editor-events.test.ts tests/plugin-settings-panel.test.ts tests/hotkey-setting-input.test.ts tests/topbar-icon.test.ts`；- [x] 抽表驱动设置配置后补充全设置项覆盖测试；- [x] `pnpm test` | `docs/project-structure.md`：补充入口层与设置层边界；`README.md`：同步开发结构与命令说明 | done |

优先级说明：
- `P0`：价值和风险都最高，优先执行
- `P1`：价值或风险中等，放在 `P0` 之后
- `P2`：低风险清理项，最后执行

状态说明：
- `pending`
- `in_progress`
- `done`
- `blocked`

## 4. 执行日志

| ID | 开始日期 | 结束日期 | 验证命令 | 结果 | 已刷新文档 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| BASELINE | 2026-03-09 | 2026-03-09 | `pnpm test` | pass | 无 | 基线通过：23 files / 65 tests |
| RF-001 | 2026-03-09 | 2026-03-09 | `pnpm exec vitest run tests/store-context.test.ts tests/live-refresh.test.ts tests/selection-mode-panel.test.ts tests/store-replace-all.test.ts tests/store-ui-state.test.ts`；`pnpm test` | pass | 待最终统一刷新 | 已新增 `tests/store-replace-all.test.ts`、`tests/store-ui-state.test.ts`，并将 `store.ts` 拆分为状态/上下文缓存/UI 持久化/替换执行四个子模块 |
| RF-002 | 2026-03-09 | 2026-03-09 | `pnpm exec vitest run tests/panel-widget.test.ts tests/minimap-widget.test.ts tests/selection-mode-panel.test.ts tests/ime-search-input.test.ts`；`pnpm test` | pass | 待最终统一刷新 | 已新增 viewport resize 与 minimap 卸载清理测试，并将 `App.vue` 交互逻辑拆分为 UI composable |
| RF-003 | 2026-03-09 | 2026-03-09 | `pnpm exec vitest run tests/editor-block-collection.test.ts tests/editor-context-detection.test.ts tests/selection-scope.test.ts tests/replacement-offset.test.ts tests/current-block-highlight.test.ts tests/match-scroll.test.ts`；`pnpm test` | pass | 待最终统一刷新 | 已新增 `tests/editor-block-collection.test.ts`，并将 `editor.ts` 拆分为 context/blocks/selection/ranges/decorations/replacement 子模块 |
| RF-004 | 2026-03-09 | 2026-03-09 | `pnpm exec vitest run tests/plugin-editor-events.test.ts tests/plugin-settings-panel.test.ts tests/hotkey-setting-input.test.ts tests/topbar-icon.test.ts`；`pnpm test` | pass | 待最终统一刷新 | 已将设置项与事件注册改为声明式辅助模块，并补齐全设置项覆盖测试 |
| DOCS | 2026-03-09 | 2026-03-09 | `pnpm precheck` | pass | `docs/project-structure.md`、`README.md`、`README_zh_CN.md` | 已创建结构文档，刷新 README，并补齐 `plugin.json.readme.zh_CN` 指向的缺失文件 |

## 5. 决策与确认

- 用户批准的条目：`RF-001`、`RF-002`、`RF-003`、`RF-004`
- 延后的条目：
- 阻塞条目及原因：
- 建议执行顺序：`RF-001` -> `RF-002` 或 `RF-003` -> `RF-004`
- 推荐最小起步范围：先做 `RF-001`。这是当前仓库耦合最高、回归成本最高、且现有测试基础最适合先加护栏的一项。

## 6. 文档刷新

- `docs/project-structure.md`：已创建，已反映最新模块结构、职责映射和测试分层
- `README.md`：已刷新，已同步当前能力、目录入口和 `pnpm` 命令
- `README_zh_CN.md`：已补齐，满足 `plugin.json.readme.zh_CN` 的发布检查要求
- 最终同步检查：`pnpm test` 通过（26 files / 75 tests），`pnpm precheck` 通过，`package.json` 脚本、README 命令、结构文档已对齐

## 7. 下一步

1. 后续如继续扩展搜索范围或支持更多块类型，优先在 `editor/*` 与 `store/*` 子模块上增量演进
2. 新增设置、事件或 UI 行为时，优先同步对应的声明式配置模块与定向测试
3. 发布前继续执行 `pnpm test` 与 `pnpm precheck`
