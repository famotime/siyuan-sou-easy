# 重构计划

## 1. 项目快照

- 生成日期：2026-04-07
- 基线提交：`b4ea9a9`（2026-04-07 拉取后的当前工作树）
- 范围：`siyuan-sou-easy` 当前 `src/`、`tests/`、`docs/`
- 目标：在不改变搜索、替换、导航、设置和面板交互行为的前提下，继续降低高复杂模块的耦合度，补齐关键回归测试，并同步更新维护文档
- 文档刷新目标：`docs/project-structure.md`，必要时同步 `README.md` / `README_zh_CN.md`
- 当前仓库状态说明：`git status --short` 为空，工作区干净，可安全开始本轮重构
- 基线测试状态：尚未执行；获批后按“先补测试/跑定向测试，再改实现，再跑全量测试”的顺序推进

## 2. 架构与模块分析

| 模块 | 关键文件 | 当前职责 | 主要痛点 | 测试覆盖情况 |
| --- | --- | --- | --- | --- |
| 插件入口与设置装配 | `src/index.ts`（305 行）, `src/main.ts`, `src/features/search-replace/plugin-command-config.ts`, `src/features/search-replace/plugin-settings-ui.ts`, `src/features/search-replace/plugin-panel-launch.ts` | 插件生命周期、顶栏与命令注册、设置面板、快捷键监听、从命令/键盘打开面板 | `src/index.ts` 仍承担较多装配与状态同步职责；虽然已拆出 panel launch / setting elements helper，但设置应用、快捷键冲突检查、命令热键同步仍集中在入口类 | 覆盖较好：`tests/plugin-command-hotkeys.test.ts`、`tests/plugin-settings-panel.test.ts`、`tests/plugin-panel-launch.test.ts`、`tests/default-hotkeys.test.ts` |
| Store 门面与搜索会话编排 | `src/features/search-replace/store.ts`（252 行）, `src/features/search-replace/store/search-controller.ts`（361 行）, `src/features/search-replace/store/search-document-events.ts`（218 行） | 面板开关、查询编辑、替换入口、刷新调度、上下文同步、文档事件监听 | 刷新链路已拆分，但公开门面、会话状态重置、查询编辑态与刷新调度边界仍较紧；`store.ts` 和 `search-controller.ts` 之间仍有双向语义耦合 | 覆盖较强：`tests/store-context.test.ts`、`tests/live-refresh.test.ts`、`tests/store-replace-all.test.ts`、`tests/store-ui-state.test.ts`；缺少针对公开门面边界和查询编辑态的直接测试 |
| 待导航恢复与异步滚动状态机 | `src/features/search-replace/store/search-pending-navigation.ts`（691 行）, `src/features/search-replace/store/search-controller.ts`, `src/features/search-replace/editor/decorations.ts` | 当前命中不可见时的重试导航、protyle 直接索引跳转、近似滚动、边界超时与提示文案维护 | 该模块已成为当前最大的状态机；直接导航、近似滚动、进度判定、重试计数、边界超时和提示状态堆叠在单文件中，理解成本和回归风险都高 | 覆盖中等：`tests/store-context.test.ts`、`tests/match-scroll.test.ts`；缺少对 direct -> approximate fallback、progress key 重置、边界超时清理的独立测试 |
| 编辑器块采集与 table 元数据 | `src/features/search-replace/editor/blocks.ts`（459 行）, `src/features/search-replace/editor/table-dom.ts`, `src/features/search-replace/editor/scroll-container.ts` | 搜索根选择、block 候选优先级、纯文本提取、table 行列与 offset 元数据生成 | 搜索根解析、候选 block 选择、owned text 规则和 table 扁平化仍混在同一模块，DOM 结构变化会放大改动面 | 覆盖中等：`tests/editor-block-collection.test.ts`、`tests/editor-table-dom.test.ts`、`tests/scroll-container.test.ts`；缺少多 `.protyle-wysiwyg` 竞争、重复候选和混合 table DOM 回退测试 |
| 高亮、滚动与可见性判定 | `src/features/search-replace/editor/decorations.ts`（697 行）, `src/features/search-replace/editor/ranges.ts`, `src/features/search-replace/editor/attribute-view.ts` | 文本高亮、块/单元格装饰、当前命中滚动、attribute-view 和 table 目标解析、可见性判定 | `decorations.ts` 仍是最复杂文件；高亮策略、scroll target 解析、容器居中与可见性判定强耦合，单次修改容易牵动多条路径 | 覆盖中等偏强：`tests/match-scroll.test.ts`、`tests/current-block-highlight.test.ts`、`tests/highlight-style.test.ts`；缺少 table fallback、attribute-view 当前命中和 `if-needed` 精确分支测试 |
| Attribute View 搜索流水线 | `src/features/search-replace/attribute-view-search.ts`（160 行）, `src/features/search-replace/attribute-view/search-candidates.ts`（621 行）, `src/features/search-replace/attribute-view/search-values.ts`（213 行）, `src/features/search-replace/attribute-view/search-blocks.ts` | AV block 发现、DOM 候选收集、rendered API 回退、字段值归一化、匹配组装 | `search-candidates.ts` 很大，DOM 候选、rendered 数据回退、列映射、去重合并混在一起；新功能路径多，后续加字段类型时容易继续膨胀 | 覆盖中等：`tests/attribute-view-search.test.ts` 较完整，但更多聚焦 happy path；缺少 DOM 优先级、视图不匹配回退、重复候选合并等边界测试 |
| 面板 minimap 与 UI 组合逻辑 | `src/features/search-replace/ui/use-panel-minimap.ts`（384 行）, `src/features/search-replace/ui/minimap-layout.ts`, `src/App.vue` | minimap 刷新、scroll target 生命周期、视口投影、点击跳转、文档上下文回退 | 几何计算已抽到 `minimap-layout.ts`，但 DOM listener 管理、scroll target 生命周期与上下文解析仍留在 composable 主体里，纯逻辑与副作用交织 | 覆盖较好：`tests/minimap-layout.test.ts`、`tests/minimap-widget.test.ts`、`tests/panel-widget.test.ts`；缺少 scroll container 切换和上下文回退的组合级测试 |

## 3. 按优先级排序的重构待办

| ID | 优先级 | 模块/场景 | 涉及文件 | 重构目标 | 行为不变约束 | 风险等级 | 重构前测试清单 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RF-201 | P0 | 待导航恢复状态机拆分 | `src/features/search-replace/store/search-pending-navigation.ts`, `src/features/search-replace/store/search-controller.ts`, `src/features/search-replace/store/search-pending-navigation-state.ts`, `tests/store-context.test.ts`, `tests/match-scroll.test.ts`, `tests/search-pending-navigation-state.test.ts` | 将 direct protyle navigation、approximate scroll、retry/backoff、timeout 清理拆成更单一的 helper/strategy，缩小 691 行状态机的认知面 | 导航提示文案不变；当前命中能见时不重复重试；不可见命中仍能在异步加载后继续尝试定位；超时后必须稳定清理 pending 状态 | 高 | - [x] 运行 `corepack pnpm test -- tests/store-context.test.ts`<br>- [x] 运行 `corepack pnpm test -- tests/match-scroll.test.ts`<br>- [x] 补充 direct -> approximate fallback / direct progress helper 测试<br>- [x] 补充 progress key 变化时重置计数测试<br>- [x] 补充 upper/lower boundary 超时清理测试 | done |
| RF-202 | P0 | 高亮与滚动目标解析拆分 | `src/features/search-replace/editor/decorations.ts`, `src/features/search-replace/editor/scroll-geometry.ts`, `src/features/search-replace/editor/ranges.ts`, `src/features/search-replace/editor/attribute-view.ts`, `src/features/search-replace/editor/table-dom.ts`, `tests/match-scroll.test.ts`, `tests/current-block-highlight.test.ts`, `tests/highlight-style.test.ts`, `tests/scroll-geometry.test.ts` | 将文本高亮、块/class 装饰、scroll target 解析、可见性判定拆成职责清晰的子模块，压缩 `decorations.ts` 的状态面 | 当前命中样式、table/attribute-view 命中定位、`if-needed` 滚动行为与 CSS Highlight 降级路径保持一致 | 高 | - [x] 运行 `corepack pnpm test -- tests/match-scroll.test.ts`<br>- [x] 运行 `corepack pnpm test -- tests/current-block-highlight.test.ts`<br>- [x] 运行 `corepack pnpm test -- tests/highlight-style.test.ts`<br>- [x] 补充 table row/cell fallback 测试（现有 `tests/match-scroll.test.ts` 已覆盖）<br>- [x] 补充 attribute-view 当前命中高亮测试（现有 `tests/current-block-highlight.test.ts` 已覆盖）<br>- [x] 补充 `if-needed` 精确可见性分支测试（新增 `tests/scroll-geometry.test.ts`，并回归 `tests/match-scroll.test.ts`） | done |
| RF-203 | P0 | 搜索块采集与 table 元数据分层 | `src/features/search-replace/editor/blocks.ts`, `src/features/search-replace/editor/block-selection.ts`, `src/features/search-replace/editor/table-dom.ts`, `src/features/search-replace/editor/scroll-container.ts`, `tests/editor-block-collection.test.ts`, `tests/editor-table-dom.test.ts`, `tests/scroll-container.test.ts`, `tests/range-location.test.ts`, `tests/block-selection.test.ts` | 将 search root 选择、block 候选排序、owned text 采集、table 元数据构建拆开，降低 DOM 规则变更时的联动范围 | block 顺序、文本 offset、table cell 映射、fallback block 选择结果不能变化 | 高 | - [x] 运行 `corepack pnpm test -- tests/editor-block-collection.test.ts`<br>- [x] 运行 `corepack pnpm test -- tests/editor-table-dom.test.ts`<br>- [x] 运行 `corepack pnpm test -- tests/scroll-container.test.ts`<br>- [x] 运行 `corepack pnpm test -- tests/range-location.test.ts`<br>- [x] 补充多 `.protyle-wysiwyg` 竞争根选择测试<br>- [x] 补充重复 block 候选与隐藏节点过滤测试<br>- [x] 补充混合 table DOM 回退测试（现有 `tests/editor-block-collection.test.ts` / `tests/editor-table-dom.test.ts` 已覆盖） | done |
| RF-204 | P1 | Attribute View 候选收集策略收束 | `src/features/search-replace/attribute-view-search.ts`, `src/features/search-replace/attribute-view/search-candidates.ts`, `src/features/search-replace/attribute-view/search-dom-candidates.ts`, `src/features/search-replace/attribute-view/search-candidate-policy.ts`, `src/features/search-replace/attribute-view/search-values.ts`, `src/features/search-replace/attribute-view/search-blocks.ts`, `tests/attribute-view-search.test.ts`, `tests/attribute-view-candidate-policy.test.ts` | 将 DOM 候选收集、rendered API 回退、列映射和候选合并整理成更稳定的分层策略，避免 `search-candidates.ts` 继续膨胀 | DOM 可用时优先使用可见候选；rendered fallback 仍覆盖 number/rollup 等字段；preview 文案和 match 元数据不变 | 中 | - [x] 运行 `corepack pnpm test -- tests/attribute-view-search.test.ts`<br>- [x] 补充 DOM 优先于 rendered 数据的测试<br>- [x] 补充视图不匹配时回退 DOM 的测试<br>- [x] 补充重复候选去重/合并测试<br>- [x] 补充断开连接 DOM block 的 fallback 测试 | done |
| RF-205 | P1 | Store 门面与查询编辑态边界收束 | `src/features/search-replace/store.ts`, `src/features/search-replace/store/search-controller.ts`, `src/features/search-replace/store/search-document-events.ts`, `src/features/search-replace/store/search-session-state.ts`, `src/features/search-replace/plugin-panel-launch.ts`, `tests/live-refresh.test.ts`, `tests/store-context.test.ts`, `tests/store-ui-state.test.ts`, `tests/plugin-panel-launch.test.ts`, `tests/search-session-state.test.ts` | 缩小 `store.ts` 公开门面对搜索会话内部状态的直接操控，把 open/close/query edit/reset 边界整理清楚 | 面板开关、replace visible 切换、query edit 时 current index 保留策略、live refresh 时序都必须保持现状 | 中 | - [x] 运行 `corepack pnpm test -- tests/live-refresh.test.ts tests/store-context.test.ts tests/store-ui-state.test.ts tests/plugin-panel-launch.test.ts`<br>- [x] 补充 open/close 状态重置测试<br>- [x] 补充 pending query index 保留/清空测试 | done |
| RF-206 | P1 | Minimap composable 副作用隔离 | `src/features/search-replace/ui/use-panel-minimap.ts`, `src/features/search-replace/ui/minimap-context.ts`, `src/features/search-replace/ui/minimap-layout.ts`, `src/App.vue`, `tests/minimap-layout.test.ts`, `tests/minimap-widget.test.ts`, `tests/panel-widget.test.ts`, `tests/minimap-context.test.ts` | 将 scroll container 监听、scroll target 生命周期、context 解析从 composable 主体抽离，让 minimap 逻辑更接近纯组合层 | minimap 标记投影、viewport 计算、点击跳转、滚动跟随行为不变 | 中 | - [x] 运行 `corepack pnpm test -- tests/minimap-layout.test.ts tests/minimap-widget.test.ts tests/panel-widget.test.ts`<br>- [x] 补充 scroll container 切换测试（现有 minimap widget / panel tests 已覆盖 listener 生命周期）<br>- [x] 补充 currentRootId 缺失时的上下文回退测试 | done |
| RF-207 | P2 | 插件入口装配继续服务化 | `src/index.ts`, `src/features/search-replace/plugin-hotkey-conflict.ts`, `src/features/search-replace/plugin-command-config.ts`, `src/features/search-replace/plugin-settings-ui.ts`, `src/features/search-replace/plugin-setting-elements.ts`, `src/settings.ts`, `tests/plugin-command-hotkeys.test.ts`, `tests/plugin-settings-panel.test.ts`, `tests/settings.test.ts`, `tests/default-hotkeys.test.ts`, `tests/hotkey-setting-input.test.ts`, `tests/plugin-hotkey-conflict.test.ts` | 继续压缩 `src/index.ts`，把设置应用、快捷键冲突检查和设置面板装配整理成更稳定的数据驱动 helper | 命令注册、设置保存提示、热键冲突提示和已存配置兼容性不变 | 中低 | - [x] 运行 `corepack pnpm test -- tests/plugin-command-hotkeys.test.ts tests/plugin-settings-panel.test.ts tests/settings.test.ts tests/default-hotkeys.test.ts tests/hotkey-setting-input.test.ts`<br>- [x] 补充设置应用与命令热键同步边界测试（由 `plugin-hotkey-conflict` helper 测试和现有 plugin tests 共同覆盖） | done |

优先级说明：
- `P0`：价值高且回归风险高，必须先补测试再动实现
- `P1`：中等风险或中等价值，放在 `P0` 之后
- `P2`：清理和一致性优化，最后处理

状态说明：
- `pending`
- `in_progress`
- `done`
- `blocked`

## 4. 执行日志

| ID | 开始日期 | 结束日期 | 验证命令 | 结果 | 已刷新文档 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| RF-201 | 2026-04-07 | 2026-04-07 | `corepack pnpm test -- tests/search-pending-navigation-state.test.ts`; `corepack pnpm test -- tests/store-context.test.ts`; `corepack pnpm test -- tests/match-scroll.test.ts` | pass | `docs/project-structure.md` | 新增纯状态 helper 并保持行为不变；当前 `vitest run -- <file>` 仍执行了全量 37 个测试文件；`corepack pnpm exec tsc -p tsconfig.json --noEmit` 仍有仓库既有错误，未作为本项阻塞 |
| RF-202 | 2026-04-07 | 2026-04-07 | `corepack pnpm test -- tests/scroll-geometry.test.ts`; `corepack pnpm test -- tests/match-scroll.test.ts`; `corepack pnpm test -- tests/current-block-highlight.test.ts`; `corepack pnpm test -- tests/highlight-style.test.ts` | pass | `docs/project-structure.md` | 抽出纯滚动几何 helper，并保持 `decorations.ts` 行为不变；当前 `vitest run -- <file>` 仍执行了全量 38 个测试文件 |
| RF-203 | 2026-04-07 | 2026-04-07 | `corepack pnpm test -- tests/block-selection.test.ts`; `corepack pnpm test -- tests/editor-block-collection.test.ts`; `corepack pnpm test -- tests/editor-table-dom.test.ts`; `corepack pnpm test -- tests/scroll-container.test.ts`; `corepack pnpm test -- tests/range-location.test.ts` | pass | `docs/project-structure.md` | 抽出 search-root / duplicate-block 选择 helper，并保持 `blocks.ts` 其余文本与 table 元数据逻辑不变；当前 `vitest run -- <file>` 仍执行了全量 39 个测试文件 |
| RF-204 | 2026-04-07 | 2026-04-07 | `corepack pnpm test -- tests/attribute-view-candidate-policy.test.ts`; `corepack pnpm test -- tests/attribute-view-search.test.ts` | pass | `docs/project-structure.md` | 抽出 attribute-view DOM candidate helper 与 fallback/merge policy helper，并保持搜索结果与 preview 元数据不变；当前 `vitest run -- <file>` 仍执行了全量 40 个测试文件 |
| RF-205 | 2026-04-07 | 2026-04-07 | `corepack pnpm test -- tests/search-session-state.test.ts`; `corepack pnpm test -- tests/live-refresh.test.ts tests/store-context.test.ts tests/store-ui-state.test.ts tests/plugin-panel-launch.test.ts` | pass | `docs/project-structure.md` | 抽出 panel open-close 和 query-edit 的纯状态 helper，并保持 store/controller 刷新时序不变；当前 `vitest run -- <file>` 仍执行了全量 41 个测试文件 |
| RF-206 | 2026-04-07 | 2026-04-07 | `corepack pnpm test -- tests/minimap-context.test.ts`; `corepack pnpm test -- tests/minimap-layout.test.ts tests/minimap-widget.test.ts tests/panel-widget.test.ts` | pass | `docs/project-structure.md` | 抽出 minimap context / scroll-container helper，并保持 viewport、点击跳转和 listener 清理行为不变；当前 `vitest run -- <file>` 仍执行了全量 42 个测试文件 |
| RF-207 | 2026-04-07 | 2026-04-07 | `corepack pnpm test -- tests/plugin-hotkey-conflict.test.ts`; `corepack pnpm test -- tests/plugin-command-hotkeys.test.ts tests/plugin-settings-panel.test.ts tests/settings.test.ts tests/default-hotkeys.test.ts tests/hotkey-setting-input.test.ts` | pass | `docs/project-structure.md` | 抽出热键冲突 ignore/source helper，并保持命令热键、设置面板和冲突提示行为不变；当前 `vitest run -- <file>` 仍执行了全量 43 个测试文件 |

## 5. 决策与确认

- 用户批准的条目：`RF-201`、`RF-202`、`RF-203`、`RF-204`、`RF-205`、`RF-206`、`RF-207`
- 延后的条目：
- 阻塞条目及原因：

## 6. 文档刷新

- `docs/project-structure.md`：至少在首个完成条目后刷新一次模块边界说明
- `README.md` / `README_zh_CN.md`：仅在用户可见行为、设置说明或开发说明发生变化时同步
- 最终同步检查：待获批条目全部完成后执行

## 7. 下一步

1. 请按条目 ID 明确批准本轮要执行的重构范围。
2. 建议优先从 `RF-201`、`RF-202`、`RF-203` 中选择一项开始；它们当前复杂度最高，回归面也最大。
3. 获批后我会严格按“先补/调测试，再做单项重构，再跑定向测试和全量测试”的顺序执行，并在每项完成后立即回写本计划。
