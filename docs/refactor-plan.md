# 重构计划（第 2 轮）

> 历史轮次：第 1 轮（RF-001~RF-005，2026-10-23）已全部完成并入库存档，见 git 历史与 `docs/project-structure.md`。

## 1. 项目快照

- 生成日期：2026-11-20
- 范围：`src/` 与 `tests/` 全量（TypeScript + Vue 3，思源笔记搜索替换插件）
- 目标：在行为不变的前提下收敛重复实现、拆分超长文件、消除已证实的过滤漂移缺陷，并为零测试保护的模块先补特征测试再重构。
- 基线验证：`pnpm test` 88 个测试文件 / 491 用例全部通过（2026-11-20）。
- 文档刷新目标：`docs/project-structure.md`、`README.md`

## 2. 架构与模块分析

| 模块 | 关键文件 | 当前职责 | 主要痛点 | 测试覆盖情况 |
| --- | --- | --- | --- | --- |
| 全库搜索状态 | `global/store.ts`（562 行） | 状态 + DOM 导航高亮 + 跳转编排 + 搜索执行 | 233 行 DOM/滚动代码（176-408）混在 store 内；无 `createInitialGlobalSearchState`/`reset` 工厂，测试直接改 `globalSearchState.results`；多个死导出 | `global-search-store/navigation/table-row/revision` 兜底 |
| 全库搜索主视图 | `global/ui/GlobalSearchDockView.vue`（1633 行） | 搜索输入、过滤、结果列表、双弹窗、双 popover、diff 编排 | 导出/预设两个弹窗内联（约 660 行）；双份 hover-popover 计时器逻辑（659-780）；`recalculateDiffSummary`（870-894）在 SFC 内不可单测；与 FilterPillsBar 的 `hasActiveFilters` 漂移（真实缺陷） | `dock-ui-redesign / dock / multi-terms / diff-and-drawer-ui` |
| 全库聚合 | `global/doc-aggregator.ts`（772 行） | 结果按文档聚合与排序 | `isFullMatch` 表达式两份逐字重复（450-453、554-557）；snippet 20+ 字段构造两份（471-496、561-583）；`aggregateBlocksToDocs` 134 行；跨块 `includes` 校验对正则/拼音词语义可疑 | `global-search-aggregator / table-row` |
| 文档内异步导航 | `store/search-pending-navigation.ts`（908 行） | 跳转重试与高亮同步 | 804 行单闭包；近似滚动引擎 8 函数约 400 行（471-700）**零测试**；`loadedBlockRange` 纯 DOM 扫描（702-864）可独立；重试调度三连重复 | `pending-navigation-controller` 仅 2 用例 |
| 编辑器装饰 | `editor/decorations.ts`（841 行） | 块装饰 + 滚动定位 + CSS Highlight 注册表 | 四类职责堆叠；`centerElementWithinContainers`（427-461）与 `centerScrollTargetWithinContainers`（463-501）逐行重复；`buildPreview`（77-86）被 `search-engine.ts`、`attribute-view/search-service.ts` 反向依赖 editor 桶 | `match-scroll` 16 用例 + `search-decoration-optimization` 5 用例 + `current-block-highlight` 11 用例，覆盖充分 |
| 面板动作编排 | `store.ts`（557 行） | 文档内面板全部动作 | `terminal` 分支散布 12 处/10 个动作；"清空终端匹配"三连重复 3 次；`goNext`/`goPrev` 镜像重复；`extractAll`（498-557）自包含业务 | `store-actions / store-terminal-search / store-replace-all` |
| 属性视图 DOM 兜底 | `attribute-view/search-dom-candidates.ts`（553 行） | 视口内 DOM 单元格采集 | **无直接单测**（每次 AV 搜索最先执行且可能 dom-only 短路）；`normalizeDomAttributeViewRowGroups`（253-364）约 110 行三套列索引对账；`getTopLevelElements`（502-507）O(n²) | 无 |
| 面板 UI hooks | `ui/use-panel-minimap.ts`、`ui/use-panel-frame.ts` | 面板定位/尺寸记忆与迷你地图 | resize 双监听：minimap 自注册（95 行）+ `App.vue:380` `onViewportResize` 转发 → 每次 resize `refreshMinimap` 执行两次；`use-panel-frame.ts:10-13` 从 minimap-layout 导入 `clamp`/`PANEL_MARGIN`（依赖错位）；scrollTo 兜底与 `scroll-container.ts` 重复 | `minimap-widget / minimap-context` |
| 插件入口 | `src/index.ts`（605 行） | 生命周期、快捷键、Lunaria bus | `registerToLunariaBus`（520-604）85 行内联；562 行 `keywords[0]` 只用第一个关键词而 `mustInclude: keywords` 声明全量（死参数）；5 个单行转发方法 | `main-layering / plugin-command-hotkeys / index-jump`；Lunaria bus 无测试 |
| 测试套件 | `tests/`（88 文件） | 自动化验证 | `store-context.test.ts` 5117 行 / 1 describe / 54 it 混 8 类主题，33 处重复 DOM 脚手架、63 处 `defineProperty`、297 处状态直赋；6 个文件重复 mock 块约 400 行；12 个文件各写一份 `resetState()`；56/88 文件手写 jsdom pragma | — |

## 3. 按优先级排序的重构待办

| ID | 优先级 | 模块/场景 | 涉及文件 | 重构目标 | 风险等级 | 重构前测试清单 | 文档影响 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RF-101 | P0 | 修复 `hasActiveFilters` 漂移缺陷并抽共享谓词 | `global/ui/FilterPillsBar.vue:188-195`<br>`global/ui/GlobalSearchDockView.vue:630-638`<br>新增 `global/filter-utils.ts` | FilterPillsBar 缺 `pathPrefix` 判定，仅 pathPrefix 过滤时"重置过滤"按钮不显示。抽 `hasActiveGlobalFilters(filters)` 纯函数供两处共用，消除双实现漂移 | 低 | - [x] 新增 filter-utils 单测（含 pathPrefix-only 场景）<br>- [x] `pnpm test tests/global-search-diff-and-drawer-ui.test.ts tests/global-search-dock-ui-redesign.test.ts` | `project-structure.md`：模块清单补 `filter-utils.ts`；`README.md`：不变 | done |
| RF-102 | P0 | 全库模块死代码与 test-only 导出清理 | `global/store.ts`<br>`global/types.ts`<br>`global/query-parser.ts`<br>`global/transaction-history.ts`<br>`tests/global-search-store.test.ts` | 删除全仓 grep 验证零引用的导出与字段：`setGlobalReplacement`（store.ts:106）、`visible`/`replacing`/`boxName`（types.ts）、`scrollToCenterTableRow`/`formatDateTime` 等多余导出；删除 test-only 的 `toggleMatchSelection`/`toggleDocSelection` 及对应测试用例；`openGlobalSearch` 生产零调用一并处理 | 低 | - [x] `pnpm test tests/global-search-store.test.ts`（同步删 test-only 用例）<br>- [x] `pnpm test` 全量<br>- [x] `pnpm build` | `project-structure.md`：对应职责描述微调；`README.md`：不变 | done |
| RF-103 | P0 | `store-context.test.ts` 拆分与 `tests/helpers/` 共享测试层 | `tests/store-context.test.ts`（5117 行/54 it）<br>新增 `tests/helpers/`<br>`tests/store-*.test.ts` 等 12 个含重复 `resetState()` 的文件 | 按主题拆 5-7 个文件（AV 搜索、长文档导航、canvas、替换、选区缓存等）并加嵌套 describe；建立 `tests/helpers/`（mock 工厂、`resetState`、protyle DOM 与滚动度量脚手架），6 份重复 mock 块与 12 份 `resetState()` 收敛；**用例总数守恒（54 it 不减）作为验收标准** | 低（纯测试改动） | - [x] 拆分后 `pnpm test` 全量用例数一致（495 守恒）<br>- [x] `pnpm test tests/store-context-*.test.ts` 8 文件 54 用例定向通过 | `project-structure.md`：测试目录说明补 `helpers/`；`README.md`：不变 | done |
| RF-104 | P0 | search-pending-navigation 特征测试补齐与模块拆分 | `store/search-pending-navigation.ts`（908 行）<br>新增 `store/approximate-scroll.ts`、`store/loaded-block-range.ts`、特征测试 | 三步走：(1) 为近似滚动引擎补特征测试；(2) 搬出纯 DOM 扫描 `loaded-block-range.ts`；(3) 搬出 `approximate-scroll.ts`；顺带消除重试调度重复（原 462-465 与 419-424 逐字相同） | 高（120ms 定时器、边界 nudge 事件、缓存失效时序均有精妙约束，故测试先行、搬移零语义变化） | - [x] 新增 `tests/loaded-block-range.test.ts` 14 个单元特征测试（距离/序列化/居中段/滚动判定/边界滚动目标/轮内缓存）<br>- [x] `pnpm test tests/pending-navigation-controller.test.ts tests/search-pending-navigation-state.test.ts` + 导航三件套 28 用例通过<br>- [x] `pnpm test` 全量 509 pass<br>- [x] `pnpm typecheck` + eslint 干净 | `project-structure.md`：store/ 目录树更新；`README.md`：不变 | done |
| RF-105 | P1 | editor/decorations.ts 三拆与重复删除 | `editor/decorations.ts`（841 行）→ `decorations.ts` + `match-scroll.ts` + `text-highlight.ts`<br>`match-utils.ts`（接收 `buildPreview`）<br>`search-engine.ts`、`attribute-view/search-service.ts`（改 import） | 按"块级装饰 / 滚动定位 / CSS Highlight 注册表"三拆；删除逐行重复的 `centerElementWithinContainers`（改走 `createElementScrollTarget` 包装）；`buildPreview` 移至 `match-utils.ts` 消除反向依赖；editor.ts 桶导出保持兼容。**可滚动判定三处语义矛盾（hidden 是否可滚）已在 match-scroll.ts 加注释记录，不统一行为** | 低 | - [x] `pnpm test tests/match-scroll.test.ts tests/search-decoration-optimization.test.ts tests/current-block-highlight.test.ts tests/highlight-style.test.ts` 等 8 文件 82 用例通过<br>- [x] `pnpm test` 全量 509 pass<br>- [x] `pnpm build` 通过 | `project-structure.md`：editor/ 目录树更新；`README.md`：不变 | done |
| RF-106 | P1 | global/store.ts 拆分为 global/store/ 子模块 | `global/store.ts` → 桶文件（33 行）<br>新增 `global/store/state.ts`（108 行）、`navigation.ts`（341 行）、`search-actions.ts`（108 行） | 对齐 `store/` 模式：`state.ts`（`createInitialGlobalSearchState`/`resetGlobalSearchState` 工厂 + UI actions + revision 守卫）、`navigation.ts`（DOM 滚动高亮与定时器链下沉）、`search-actions.ts`（`executeGlobalSearch` + filter 合并 + in-flight 计数）；原 `store.ts` 改为桶式 re-export 保持兼容，消费者零改动；global-search-store 测试改用工厂重置隔离用例 | 中 | - [x] `pnpm test tests/global-search-store.test.ts tests/global-search-navigation.test.ts tests/global-search-table-row.test.ts tests/global-search-revision.test.ts` 等 7 文件 33 用例通过<br>- [x] `pnpm test` 全量 509 pass<br>- [x] `pnpm typecheck` + eslint 干净 | `project-structure.md`：global/ 目录树更新；`README.md`：不变 | done |
| RF-107 | P1 | GlobalSearchDockView.vue 组件拆分 | `global/ui/GlobalSearchDockView.vue`（1627→1131 行）<br>新增 `ExportResultsModal.vue`（114）、`PresetsModal.vue`（209）、`PopupModalShell.vue`（126）、`use-hover-popover.ts`（100）、`use-batch-replace-diff.ts`（124）<br>`global/diff-builder.ts`（接收 `recalculateDiffSummary`） | 抽出导出/预设两个弹窗子组件（共用 PopupModalShell 外壳）；双份 hover popover 计时器抽 `use-hover-popover`（参数化延迟 + onOpen 互斥回调）；diff 编排抽 `use-batch-replace-diff`；`recalculateDiffSummary` 移入 `diff-builder.ts` 为导出纯函数并补 2 个单测。**偏离说明：query 输入未改为单写路径——测试 global-search-dock 直接改写 state.query 并依赖 watch 立即清空旧结果，v-model+watch 即该语义的唯一实现，已在组件内注释记录** | 低-中 | - [x] diff-builder 新增 `recalculateDiffSummary` 单测（2 个）<br>- [x] `pnpm test tests/global-search-dock.test.ts tests/global-search-dock-ui-redesign.test.ts tests/global-search-multi-terms-and-help-ui.test.ts tests/global-search-diff-and-drawer-ui.test.ts tests/global-diff-builder.test.ts` 等 13 文件 64 用例通过<br>- [x] `pnpm test` 全量 511 pass<br>- [x] `pnpm build` 通过 | `project-structure.md`：global/ui/ 清单更新；`README.md`：不变 | done |
| RF-108 | P1 | store.ts 终端会话下沉与 extractAll 外移 | `store.ts`（557→400 行）<br>新增 `store/terminal-session.ts`（151 行）、`store/extraction.ts`（69 行） | 抽终端会话对象（open/refresh/reset/step/goTo/toggleOption/handleQueryEdit/clearMatches），主动作只判一次 mode；3 处"清空三连"重复收敛为 `clearMatches`；`goNext`/`goPrev` 合并为 `stepCurrent(delta)`；新增 `applyTerminalPanelState` 对齐 `applyOpenPanelState` 模式；`extractAll` 下沉 `extraction.ts`（与 `global/export-utils` 的块引用格式差异保留，已在注释记录不合并） | 低 | - [x] `pnpm test tests/store-terminal-search.test.ts tests/store-actions.test.ts tests/store-replace-all.test.ts` 等 8 文件 47 用例通过<br>- [x] `pnpm test` 全量 511 pass<br>- [x] `pnpm typecheck` + eslint 干净 | `project-structure.md`：store/ 目录树更新；`README.md`：不变 | done |
| RF-109 | P1 | search-dom-candidates 特征测试补齐与拆分 | `attribute-view/search-dom-candidates.ts`<br>新增 `tests/attribute-view-dom-candidates.test.ts`（8 用例） | (1) 为 4 类候选收集器（title/header/group/row）补特征测试钉住行为（含去重、列序发现、嵌套顶层过滤、可见性过滤）；(2) `normalizeDomAttributeViewRowGroups` 拆分：单元格收集抽 `collectRowGroupCandidates`、发现列闭包抽 `createDomColumnAllocator`（顺带移除一段经测试证实的不可达死代码并注释）；(3) `getTopLevelElements` O(n²) 降为 O(n·d)（祖先链遍历，行为等价） | 中（先测试后动） | - [x] 新增 8 个特征测试（红→绿验证理解一致，钉住现状）<br>- [x] `pnpm test tests/attribute-view-dom-candidates.test.ts tests/attribute-view-search.test.ts tests/attribute-view-candidate-policy.test.ts tests/store-context-av-search.test.ts` 53 用例通过<br>- [x] `pnpm test` 全量 519 pass<br>- [x] `pnpm typecheck` + eslint 干净 | `project-structure.md`：attribute-view/ 描述微调；`README.md`：不变 | done |
| RF-110 | P2 | 编辑器层跨文件重复收敛 | `ui/use-panel-minimap.ts`、`ui/use-panel-frame.ts`、`ui/minimap-layout.ts`<br>新增 `ui/layout-constants.ts`、`store/minimap-blocks.ts`<br>`store/loaded-block-range.ts` | 消除 resize 双监听（minimap 独立监听 + App.vue 经 use-panel-frame 转发 → 每次 resize `refreshMinimap` 执行两次，删除前者）；minimap 本地 `scrollTo` 统一走 `scrollContainerTo`；`blockId→blockIndex` Map 抽 `createBlockIndexByIdMap` 共享；`PANEL_MARGIN`/`clamp` 提至 `layout-constants.ts` 消除 minimap-layout 依赖错位。**偏离说明：approximate-scroll 的 scrollTo 分支保留——其"尝试 scrollTo 后校验落点、失败回退 scrollTop"语义与 scrollContainerTo 不同，非简单重复** | 低 | - [x] `pnpm test tests/minimap-widget.test.ts tests/minimap-context.test.ts tests/minimap-layout.test.ts tests/panel-widget.test.ts tests/scroll-container.test.ts tests/match-scroll.test.ts tests/loaded-block-range.test.ts tests/store-context-nav-approx.test.ts` 76 用例通过<br>- [x] `pnpm test` 全量 519 pass<br>- [x] `pnpm typecheck` + eslint 干净 | `project-structure.md`：微调；`README.md`：不变 | done |
| RF-111 | P2 | 长函数拆分与 doc-aggregator 去重 | `global/doc-aggregator.ts`、`global/replace-engine.ts`、`global/query-parser.ts`、`global/store/navigation.ts`、`store/search-controller.ts`<br>`tests/global-search-aggregator.test.ts`（+3 钉住用例） | 抽 `isFullMultiTermMatch`（两份逐字重复）与 `buildGlobalMatchSnippet`（表格/普通块两份 20+ 字段构造）；`aggregateBlocksToDocs` 拆出 `verifyCrossBlockMatch` 纯函数并在注释记录跨块 includes 对正则/拼音词的已知缺陷（**现状钉住，不修行为**）；`parseGlobalQuery` 拆 `classifyQueryTokens` + `assembleQueryTerms`；`findTargetTableRowElement` 拆 `findBestScoredTableRow`；`executeBatchReplace` 抽 `collectActiveDiffItems`/`groupDiffItemsByBlock`/`buildReplaceTransactionItem`（取消计数耦合段不硬拆）；`refreshMatches` 拆 `computeSearchOutcome`（revision 检查语义不变） | 中 | - [x] 先补 3 个跨块多词现状钉住测试（普通词 cross-block 成功/exact-block/正则词误杀固化）<br>- [x] 聚合/解析/替换/导航定向 29+32+36 用例通过<br>- [x] `pnpm test` 全量 522 pass<br>- [x] `pnpm typecheck` + eslint 干净 | `project-structure.md`：微调；`README.md`：不变 | done |
| RF-112 | P2 | index.ts Lunaria bus 抽取与薄包装清理 | `src/index.ts`<br>新增 `lunaria-bus.ts`（注册体 + 检索执行）<br>新增 `tests/lunaria-bus.test.ts`（5 用例） | `registerToLunariaBus` 的注册体与 `searchNotesByKeywords` 执行抽独立模块，index.ts 仅保留 window 事件编排；keywords[0] 死参数语义以注释说明（SQL 预过滤取首词 + mustInclude 全量 AND，修正工具描述），运行时行为不变；顺带钉住 root_id 空值回退 record.id 与标题回退"未命名文档"的现状 | 低 | - [x] 新增 lunaria bus 单测 5 个（工具注册/分发/空关键词/全量 mustInclude/聚合截断）<br>- [x] `pnpm test tests/lunaria-bus.test.ts tests/main-layering.test.ts tests/index-jump.test.ts` 通过<br>- [x] `pnpm test` 全量 527 pass<br>- [x] `pnpm typecheck` + eslint 干净 | `project-structure.md`：入口模块说明更新；`README.md`：不变 | done |
| RF-113 | P2 | UI 共享抽取（DiffComparisonLines + use-toggle-set） | `global/ui/VisualDiffModal.vue`、`global/ui/ReplaceHistoryTabView.vue`<br>新增 `DiffComparisonLines.vue`、`use-toggle-set.ts` | diff 对比行模板与约 110 行 CSS 逐字重复，抽共享组件（回退逻辑由调用方解析后传 props）；Set 折叠切换三处手写 + "全部展开/收起"判定抽 `useToggleSet`（has/toggle/toggleAll/isAllSelected） | 低 | - [x] `pnpm test tests/global-search-diff-and-drawer-ui.test.ts tests/global-search-history-tab.test.ts tests/global-search-dock-ui-redesign.test.ts` 11 用例通过<br>- [x] `pnpm test` 全量 527 pass<br>- [x] `pnpm typecheck` + eslint 干净 | `project-structure.md`：global/ui/ 清单更新；`README.md`：不变 | done |
| RF-114 | P2 | 测试环境统一与大文件 describe 结构 | `vitest.config.ts`（默认环境 node→jsdom）<br>65 个 jsdom pragma 移除 / 33 个 node 反向标注（含 1 个原为 docblock 形式的误判修正）<br>三个大测试文件补嵌套 describe（match-scroll 4 组 / attribute-view-search 7 组 / current-block-highlight 3 组） | 全局环境改默认 jsdom，原 node 文件反向标注保持逐文件环境完全等价；三大文件按主题分组改善定向运行（`-t`）体验；全程 527 用例守恒 | 极低 | - [x] `pnpm test` 全量 99 文件 / 527 pass（守恒）<br>- [x] `pnpm typecheck` + eslint 干净 | 无 | done |

优先级说明：
- `P0`：价值高且风险高（需强化测试），或缺陷修复与高价值清理，优先执行
- `P1`：中等风险或中等价值的结构重构，放在 P0 之后
- `P2`：低风险清理与一致性优化，最后处理

状态说明：`pending` / `in_progress` / `done` / `blocked`

## 4. 执行日志

| ID | 开始日期 | 结束日期 | 验证命令 | 结果 | 已刷新文档 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| RF-101 | 2026-11-20 | 2026-11-20 | `pnpm test tests/global-filter-utils.test.ts ...`（红→绿）→ `pnpm test` 全量 497 pass | pass | 待统一刷新 | 新增 `global/filter-utils.ts` + 6 用例（含 pathPrefix-only 组件回归）；两组件改用共享谓词 |
| RF-102 | 2026-11-20 | 2026-11-20 | `pnpm typecheck` + `pnpm test` 全量 495 pass + `pnpm build` 通过 | pass | 待统一刷新 | 删除 `setGlobalReplacement`/`openGlobalSearch`/`closeGlobalSearch`/`toggleMatchSelection`/`toggleDocSelection`/`visible`/`replacing`/`boxName`；`scrollToCenterTableRow`/`formatDateTime`/`stripQuotes`/`tokenizeGlobalQuery` 转私有；同步删 2 个 test-only 用例（497→495） |
| RF-103 | 2026-11-20 | 2026-11-20 | `pnpm test` 全量 96 文件/495 pass（54 用例守恒）+ `pnpm typecheck` 通过 | pass | 待统一刷新 | 原 5117 行 store-context.test.ts 按主题拆为 8 个文件（core/selection-snapshot/av-search/nav-retry/nav-approx/nav-containers/replace/selection-cache）；新建 tests/helpers/（store-context-mocks、store-context-state、store-context-lifecycle、store-state）；9 个文件的本地 resetState 收敛为共享超集；vi.mock 采用工厂内动态 import 模式。备注：attribute-view-search/global-notebooks/pending-navigation-controller 的 kernelMocks 默认实现各异，评估后保留（合并收益低于风险） |
| RF-104 | 2026-11-20 | 2026-11-20 | 导航定向 28 用例 + 新增 14 单测 + 全量 509 pass + typecheck/eslint 干净 | pass | 待统一刷新 | search-pending-navigation.ts 908→446 行；搬出 approximate-scroll.ts（282 行，依赖显式化为 deps）与 loaded-block-range.ts（252 行，含缓存工厂 createLoadedBlockRangeResolver）；消除 unfold 重试调度重复；特征测试网 = 既有 22 个导航集成用例 + 14 个新单元用例 |
| RF-105 | 2026-11-20 | 2026-11-20 | 装饰/滚动定向 8 文件 82 用例 + 全量 509 pass + `pnpm build` 通过 | pass | 待统一刷新 | decorations.ts 841→163 行；新增 match-scroll.ts（445 行）、text-highlight.ts（236 行）；删除 centerElementWithinContainers 逐行重复（约 35 行）；buildPreview 迁至 match-utils.ts，search-engine 与 attribute-view/search-service 改直连 import；editor.ts 桶导出兼容不变；可滚动判定语义矛盾已在注释中记录 |
| RF-106 | 2026-11-20 | 2026-11-20 | 全库定向 7 文件 33 用例 + 全量 509 pass + typecheck/eslint 干净 | pass | 待统一刷新 | global/store.ts 529→33 行桶文件；新增 store/state.ts（工厂 + UI 动作 + revision）、store/navigation.ts（DOM 高亮下沉 + 定时器链）、store/search-actions.ts（搜索执行 + in-flight）；消费者零改动；global-search-store 测试加工厂重置隔离 |
| RF-107 | 2026-11-20 | 2026-11-20 | 全库 UI 定向 13 文件 64 用例 + 全量 511 pass + `pnpm build` 通过 | pass | 待统一刷新 | DockView 1627→1131 行；新增 ExportResultsModal/PresetsModal/PopupModalShell + use-hover-popover/use-batch-replace-diff；recalculateDiffSummary 移入 diff-builder（补 2 单测）；query 单写路径收敛经评估不做（见偏离说明） |
| RF-108 | 2026-11-20 | 2026-11-20 | 终端/动作定向 8 文件 47 用例 + 全量 511 pass + typecheck/eslint 干净 | pass | 待统一刷新 | store.ts 557→400 行；终端 12 处散布分支收敛为 terminal-session 会话对象（含 applyTerminalPanelState 纯函数与 clearMatches 三连去重）；goNext/goPrev 合并 stepCurrent；extractAll 下沉 extraction.ts |
| RF-109 | 2026-11-20 | 2026-11-20 | AV 定向 5 文件 53 用例 + 全量 519 pass + typecheck/eslint 干净 | pass | 待统一刷新 | 新增 8 个 DOM 兜底特征测试；row 归一化拆 collectRowGroupCandidates + createDomColumnAllocator；移除经测试证实的不可达死代码；getTopLevelElements O(n²)→O(n·d) |
| RF-110 | 2026-11-20 | 2026-11-20 | 编辑器/UI 定向 9 文件 76 用例 + 全量 519 pass + typecheck/eslint 干净 | pass | 待统一刷新 | 删除 minimap 独立 resize 监听（双刷新缺陷）；scrollTo 统一 scrollContainerTo（approximate-scroll 校验式分支保留并注释）；新增 layout-constants.ts 与 minimap-blocks.ts 共享层 |
| RF-111 | 2026-11-20 | 2026-11-20 | 全库/控制器定向多轮（29/32/36/57 用例）+ 全量 522 pass + typecheck/eslint 干净 | pass | 待统一刷新 | doc-aggregator：isFullMultiTermMatch + buildGlobalMatchSnippet 去重、verifyCrossBlockMatch 拆出并记录已知缺陷（3 个钉住用例固化）；query-parser/classifyQueryTokens + assembleQueryTerms；navigation/findBestScoredTableRow；replace-engine 三段抽取；search-controller/computeSearchOutcome 拆段 |
| RF-112 | 2026-11-20 | 2026-11-20 | lunaria 定向 5 新用例 + 入口回归 + 全量 527 pass + typecheck/eslint 干净 | pass | 待统一刷新 | index.ts Lunaria 注册体抽 lunaria-bus.ts；工具描述修正 keywords AND 语义说明（运行时不变）；新增 5 单测钉住 root_id 回退与标题回退现状 |
| RF-113 | 2026-11-20 | 2026-11-20 | Diff UI 定向 11 用例 + 全量 527 pass + typecheck/eslint 干净 | pass | 待统一刷新 | 新增 DiffComparisonLines.vue（模板+约 110 行 CSS 去重）与 useToggleSet（三处折叠切换收敛）；两组件改用后行为不变 |
| RF-114 | 2026-11-21 | 2026-11-21 | 全量 99 文件 / 527 pass（守恒）+ typecheck/eslint 干净 | pass | 待统一刷新 | vitest 默认环境 node→jsdom；65 处 jsdom pragma 移除、33 处 node 反向标注（逐文件环境等价；canvas-live-refresh 的 docblock 误判已修正）；三大测试文件按主题补 14 个嵌套 describe |

## 5. 决策与确认

- 用户批准的条目：RF-101~RF-114 全部批准（2026-11-20，AskUserQuestion 确认"全部批准 RF-101~RF-114"）
- 建议执行顺序：RF-101 → RF-102 → RF-103 → RF-104 → RF-105 → RF-106 → RF-107 → RF-108 → RF-109 → RF-110 → RF-111 → RF-112 → RF-113 → RF-114
- 延后的条目：无
- 阻塞条目及原因：无

## 6. 文档刷新

- `docs/project-structure.md`：已按第 2 轮重构后的实际模块结构全量重写（新增 store/、global/store/、editor/ 拆分文件、global/ui/ 弹窗与 hooks、tests/helpers/、测试环境说明）。
- `README.md`：用户可见能力与开发命令核对无过期项；补充 `docs/project-structure.md` 架构文档链接。
- 最终同步检查：`pnpm typecheck` 干净 + `pnpm test` 99 文件 / 527 用例全过 + `eslint src/ tests/` 0 错误 + `pnpm build` 产物校验通过（2026-11-21）。

## 7. 范围外备注（本次不做，留待产品决策或后续轮次）

1. **i18n 一致化**：GlobalSearchDockView 约 40 处硬编码中文 vs 两个 HelpPopover 全走 `t()`；是否补齐双语 key 取决于产品语言策略。
2. **结果列表窗口化渲染**：拼音模式 `limit=2000` 全量渲染 DocAggregateItem 的性能保护（新能力，非重构）。
3. **doc-aggregator 跨块校验语义修正**：正则/拼音词在跨块联合匹配中被 `includes` 误杀——已由 RF-111 的钉住测试固化现状（`tests/global-search-aggregator.test.ts`），修复属行为变更需单独决策。
4. **defineExpose → props/emits 改造**、**手写 TTL 缓存统一**、**lunaria 中 `|| '未命名笔记'` 死分支**：风格改进，价值一般（lunaria 现状已在单测中钉住）。

## 8. 下一步

1. 第 2 轮重构（RF-101~RF-114）已全部完成并通过最终同步检查。
2. 建议以一个 `refactor` 提交（或按 P0/P1/P2 分三个提交）入库本批改动。
3. 范围外备注中的行为级修复（尤其第 3 项）可在下一轮单独决策执行。
