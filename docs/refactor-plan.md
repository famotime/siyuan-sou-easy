# 重构计划

## 1. 项目快照

- 生成日期：2026-04-06
- 范围：`siyuan-sou-easy` 当前 `src/`、`tests/`、`docs/`
- 目标：在不改变现有搜索、替换、导航、设置与面板交互行为的前提下，继续降低高复杂模块的耦合度，补齐关键回归测试，并为后续文档同步预留清晰边界
- 文档刷新目标：`docs/project-structure.md`、`README.md`
- 当前仓库状态说明：`git status --short` 为空，工作区干净，可安全开始新一轮重构

## 2. 架构与模块分析

| 模块 | 关键文件 | 当前职责 | 主要痛点 | 测试覆盖情况 |
| --- | --- | --- | --- | --- |
| 插件入口与公共动作门面 | `src/index.ts`, `src/main.ts`, `src/features/search-replace/store.ts` | 插件生命周期、顶栏与命令注册、快捷键捕获、设置应用、面板开关、替换入口与 UI 状态落盘 | `src/index.ts` 仍有 266 行，`store.ts` 仍有 217 行；入口装配、设置应用、公开动作与状态清理仍集中在少数大文件里，后续新增入口或公共动作时仍需要跨文件同步修改 | 覆盖较好：`tests/plugin-command-hotkeys.test.ts`、`tests/plugin-settings-panel.test.ts`、`tests/plugin-panel-launch.test.ts`、`tests/store-replace-all.test.ts`、`tests/store-ui-state.test.ts` |
| 搜索刷新与会话编排 | `src/features/search-replace/store/search-controller.ts`, `src/features/search-replace/store/search-document-events.ts`, `src/features/search-replace/store/search-pending-navigation.ts`, `src/features/search-replace/store/search-blocks.ts` | 查询刷新调度、上下文切换、实时监听、待导航恢复、块解析回退、命中高亮同步 | `search-controller.ts` 仍有 319 行，还是刷新链路的中心节点；调度、状态收束、属性视图合并和导航恢复仍紧耦合，理解和扩展成本高 | 覆盖中等偏强：`tests/live-refresh.test.ts`、`tests/store-context.test.ts`、`tests/selection-mode-panel.test.ts`；缺少对查询编辑态重置和公共门面边界的直接测试 |
| 编辑器块解析与搜索根选择 | `src/features/search-replace/editor/blocks.ts`, `src/features/search-replace/editor/table-dom.ts`, `src/features/search-replace/editor/scroll-container.ts` | 选择搜索根、解析块 DOM、提取纯文本、表格单元格扁平化、按上下文挑选最合适的 block/root 元素 | `blocks.ts` 仍有 386 行；搜索根选择、文本归属判断、表格元数据构建和可见区域优先规则混在同一文件，任何 DOM 结构调整都会扩大改动面 | 覆盖中等：`tests/editor-block-collection.test.ts`、`tests/editor-table-dom.test.ts`、`tests/scroll-container.test.ts`；缺少多 `.protyle-wysiwyg` 竞争、重复 block 候选选择、混合 table DOM 退化路径测试 |
| 编辑器高亮、滚动与可见性判定 | `src/features/search-replace/editor/decorations.ts`, `src/features/search-replace/editor/ranges.ts`, `src/features/search-replace/editor/attribute-view.ts` | 文本高亮、块/单元格 class 装饰、当前命中滚动、table/attribute-view 目标解析、可见性判定 | `decorations.ts` 仍有 598 行，是当前最复杂文件；高亮策略、滚动目标选择、容器内居中与 table/attribute-view 特例都堆在一个模块，回归面大且难测 | 覆盖中等：`tests/match-scroll.test.ts`、`tests/current-block-highlight.test.ts`、`tests/highlight-style.test.ts`；缺少 table fallback、attribute-view 当前命中、`if-needed` 精准可见性分支测试 |
| 面板 minimap 与 UI 组合逻辑 | `src/features/search-replace/ui/use-panel-minimap.ts`, `src/features/search-replace/ui/minimap-layout.ts`, `src/App.vue` | minimap 刷新、滚动监听、当前文档上下文选择、视口/标记投影、点击滚动、挂载解绑 | `use-panel-minimap.ts` 仍有 340 行；虽然几何计算已抽到 `minimap-layout.ts`，但 DOM 监听、scroll target 生命周期、上下文回退与数据投影仍混在 composable 中 | 覆盖较好：`tests/minimap-widget.test.ts`、`tests/minimap-layout.test.ts`、`tests/panel-widget.test.ts`；缺少 listener 切换和上下文回退的纯组合级测试 |

## 3. 按优先级排序的重构待办

| ID | 优先级 | 模块/场景 | 涉及文件 | 重构目标 | 风险等级 | 重构前测试清单 | 文档影响 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RF-201 | P0 | 编辑器高亮、滚动与目标解析拆分 | `src/features/search-replace/editor/decorations.ts`, `src/features/search-replace/editor/ranges.ts`, `src/features/search-replace/editor/attribute-view.ts`, `src/features/search-replace/editor/table-dom.ts`, `tests/match-scroll.test.ts`, `tests/current-block-highlight.test.ts`, `tests/highlight-style.test.ts` | 将文本高亮、块/class 装饰、滚动目标解析、可见性判定拆成职责更单一的 helper 或子模块，压缩 `decorations.ts` 的状态面 | 高。直接影响当前命中高亮、table/attribute-view 命中定位与滚动体验 | - [ ] 运行 `pnpm test -- tests/match-scroll.test.ts`<br>- [ ] 运行 `pnpm test -- tests/current-block-highlight.test.ts`<br>- [ ] 运行 `pnpm test -- tests/highlight-style.test.ts`<br>- [ ] 补充 table row/cell fallback 与 attribute-view 当前命中高亮测试<br>- [ ] 补充 `if-needed` 可见性分支与 CSS Highlight 不可用分支测试 | `docs/project-structure.md` 需要更新 editor 装饰相关职责；`README.md` 通常无用户可见变更，除非顺带修复滚动/高亮行为并需说明 | pending |
| RF-202 | P0 | 编辑器块解析、搜索根选择与表格元数据分层 | `src/features/search-replace/editor/blocks.ts`, `src/features/search-replace/editor/table-dom.ts`, `src/features/search-replace/editor/scroll-container.ts`, `tests/editor-block-collection.test.ts`, `tests/editor-table-dom.test.ts`, `tests/scroll-container.test.ts` | 将搜索根选择、block 候选优先级、纯文本提取、table 元数据扁平化拆开，降低 DOM 规则修改时的联动范围 | 高。该模块影响所有搜索块采集、table offset 计算和当前文档根解析 | - [ ] 运行 `pnpm test -- tests/editor-block-collection.test.ts`<br>- [ ] 运行 `pnpm test -- tests/editor-table-dom.test.ts`<br>- [ ] 运行 `pnpm test -- tests/scroll-container.test.ts`<br>- [ ] 补充多 `.protyle-wysiwyg` 竞争时的根选择测试<br>- [ ] 补充重复 block 候选、隐藏节点过滤和混合 table DOM 回退测试 | `docs/project-structure.md` 需要更新 editor block/search-root 相关职责；`README.md` 通常无需改动 | pending |
| RF-203 | P1 | 搜索公共门面与会话编排边界收束 | `src/features/search-replace/store.ts`, `src/features/search-replace/store/search-controller.ts`, `tests/live-refresh.test.ts`, `tests/store-context.test.ts`, `tests/store-replace-all.test.ts`, `tests/store-ui-state.test.ts` | 缩小 `store.ts` 与 `search-controller.ts` 之间的耦合，把公开动作、状态重置、替换依赖注入和刷新调度边界整理清楚，便于后续继续拆分 | 中。涉及公开 store API 和查询编辑态，若处理不慎会引入刷新时序回归 | - [ ] 运行 `pnpm test -- tests/live-refresh.test.ts`<br>- [ ] 运行 `pnpm test -- tests/store-context.test.ts`<br>- [ ] 运行 `pnpm test -- tests/store-replace-all.test.ts`<br>- [ ] 运行 `pnpm test -- tests/store-ui-state.test.ts`<br>- [ ] 补充 open/close 重置、pending query index 保留与 query edit 清空路径测试 | `docs/project-structure.md` 需要更新 store facade / controller 职责；`README.md` 仅在对外行为或开发说明变更时同步 | pending |
| RF-204 | P1 | minimap composable 继续瘦身 | `src/features/search-replace/ui/use-panel-minimap.ts`, `src/features/search-replace/ui/minimap-layout.ts`, `src/App.vue`, `tests/minimap-widget.test.ts`, `tests/minimap-layout.test.ts`, `tests/panel-widget.test.ts` | 将 minimap 的 DOM listener 管理、上下文解析与 scroll target 生命周期从 composable 主体中抽离，让 composable 更接近纯组合层 | 中。主要风险在滚动同步、延迟加载增高后的视口稳定性和 listener 泄漏 | - [ ] 运行 `pnpm test -- tests/minimap-layout.test.ts`<br>- [ ] 运行 `pnpm test -- tests/minimap-widget.test.ts`<br>- [ ] 运行 `pnpm test -- tests/panel-widget.test.ts`<br>- [ ] 补充 scroll container 切换与上下文回退测试 | `docs/project-structure.md` 需要更新 UI composable 职责；`README.md` 仅在用户可见面板行为改变时同步 | pending |
| RF-205 | P2 | 插件入口的快捷键与设置应用服务化 | `src/index.ts`, `src/features/search-replace/plugin-command-config.ts`, `src/features/search-replace/plugin-settings-ui.ts`, `src/settings.ts`, `tests/plugin-command-hotkeys.test.ts`, `tests/plugin-settings-panel.test.ts`, `tests/settings.test.ts`, `tests/default-hotkeys.test.ts`, `tests/hotkey-setting-input.test.ts` | 继续压缩 `src/index.ts`，把快捷键冲突检查、设置应用和注册装配整理成更稳定的数据驱动 helper | 中低。用户可见行为不应变化，但命令注册时序和设置保存提示较敏感 | - [ ] 运行 `pnpm test -- tests/plugin-command-hotkeys.test.ts`<br>- [ ] 运行 `pnpm test -- tests/plugin-settings-panel.test.ts`<br>- [ ] 运行 `pnpm test -- tests/settings.test.ts`<br>- [ ] 运行 `pnpm test -- tests/default-hotkeys.test.ts`<br>- [ ] 运行 `pnpm test -- tests/hotkey-setting-input.test.ts`<br>- [ ] 补充设置应用与命令热键同步的边界测试 | `docs/project-structure.md` 需要更新入口层职责；`README.md` 如快捷键说明或开发命令说明变更则同步 | pending |

优先级说明：
- `P0`：价值高且风险高，必须先补测试再动实现
- `P1`：中等价值或风险，放在 `P0` 之后
- `P2`：清理与一致性优化，最后处理

状态说明：
- `pending`
- `in_progress`
- `done`
- `blocked`

## 4. 执行日志

| ID | 开始日期 | 结束日期 | 验证命令 | 结果 | 已刷新文档 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| RF-201 |  |  |  |  |  |  |
| RF-202 |  |  |  |  |  |  |
| RF-203 |  |  |  |  |  |  |
| RF-204 |  |  |  |  |  |  |
| RF-205 |  |  |  |  |  |  |

## 5. 决策与确认

- 用户批准的条目：
- 延后的条目：
- 阻塞条目及原因：

## 6. 文档刷新

- `docs/project-structure.md`：待最后一项获批条目完成后同步
- `README.md`：待最后一项获批条目完成后同步
- 最终同步检查：待执行

## 7. 下一步

1. 请按条目 ID 明确批准本轮要执行的重构范围。
2. 建议先从 `RF-201`、`RF-202` 开始，它们当前复杂度最高、回归面也最大。
3. 获批后我会严格按“先补/调测试，再做单项重构，再跑定向测试和全量测试”的顺序执行。
