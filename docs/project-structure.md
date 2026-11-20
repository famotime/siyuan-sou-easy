# 项目结构与架构说明 (Project Structure)

本文档记录 `siyuan-sou-easy` 插件的代码组织、核心模块划分与职责映射，供开发者与维护 Agent 查阅。

> 状态基准：第 2 轮重构（RF-101~RF-114，见 `docs/refactor-plan.md`）完成后的结构，99 个测试文件 / 527 用例全过。

## 1. 目录总览

```text
siyuan-sou-easy/
├── src/
│   ├── index.ts                      # 插件主入口类 (FriendlySearchReplacePlugin)
│   ├── main.ts                       # UI 挂载与卸载驱动
│   ├── settings.ts                   # 插件配置项、默认值与持久化
│   ├── hotkeys.ts                    # 快捷键解析、规范化与冲突检测
│   ├── icons.ts                      # SVG 图标定义与注册
│   ├── App.vue                       # 文档内搜索与替换浮动面板组件
│   ├── index.scss                    # 全局及组件样式
│   ├── plugin-instance.ts            # 插件实例全局引用 (供 i18n 等模块访问)
│   ├── lunaria-bus.ts                # Lunaria 工具总线注册体与 searchNotesByKeywords 执行
│   ├── components/                   # 公共 UI 组件
│   │   └── SiyuanTheme/              # WireframeIcon 线框图标组件
│   ├── features/search-replace/      # 核心业务功能目录
│   │   ├── types.ts                  # 基础搜索类型与接口
│   │   ├── editor.ts                 # editor/ 模块的桶式导出 (barrel)
│   │   ├── store.ts                  # store/ 模块的桶式导出与面板业务编排
│   │   ├── search-engine.ts          # 正则、全字、大小写文本匹配核心引擎
│   │   ├── kernel.ts                 # 思源内核 API 通信封装 (SQL, DOM, Keymap 等)
│   │   ├── debug.ts                  # 调试日志与节点检查
│   │   ├── match-utils.ts            # 匹配结果工具函数 + buildPreview 文本预览构造
│   │   ├── preserve-case.ts          # 保留大小写样式替换算法
│   │   ├── native-navigation.ts      # 原生光标与块定位辅助
│   │   ├── settings-panel.ts         # 设置面板类型与元数据
│   │   ├── plugin-command-config.ts  # 命令与快捷键注册辅助
│   │   ├── plugin-environment.ts     # 运行环境探测 (移动端/浏览器/Electron)
│   │   ├── plugin-events.ts          # 编辑器上下文事件总线绑定
│   │   ├── plugin-hotkey-conflict.ts # 快捷键冲突来源收集
│   │   ├── plugin-panel-launch.ts    # 面板打开入口 (命令/键盘事件)
│   │   ├── plugin-setting-elements.ts# 设置项 DOM 元素构建 (输入框/颜色/热键捕获)
│   │   ├── plugin-settings-ui.ts     # 设置面板 DOM 构建与绑定
│   │   ├── editor/                   # Protyle 编辑器 DOM 访问与装饰层
│   │   │   ├── context.ts            # 编辑器上下文获取与缓存匹配
│   │   │   ├── blocks.ts             # 块元素收集与文本解析 (支持表格、多容器)
│   │   │   ├── block-selection.ts    # 选区覆盖块判定与视口矩形工具
│   │   │   ├── constants.ts          # 编辑器层常量
│   │   │   ├── decorations.ts        # 块级/表格/属性视图 class 装饰的同步与清除
│   │   │   ├── match-scroll.ts       # 匹配滚动定位与可视性判定 (自 decorations 拆出)
│   │   │   ├── text-highlight.ts     # CSS Custom Highlight 注册表与文本高亮缓存
│   │   │   ├── ranges.ts             # 文本范围定位与表格单元格定位
│   │   │   ├── replacement.ts        # DOM 文本节点就地替换与克隆计算
│   │   │   ├── scroll-container.ts   # 滚动容器解析与几何计算
│   │   │   ├── scroll-geometry.ts    # 滚动位置几何换算
│   │   │   ├── selection.ts          # 选区范围识别与选区内模式 (selectionOnly)
│   │   │   ├── table-dom.ts          # 表格单元格精确定位与文本操作
│   │   │   └── attribute-view.ts     # 编辑器内属性视图单元格 DOM 定位
│   │   ├── store/                    # 文档内搜索状态管理
│   │   │   ├── state.ts              # 响应式状态树定义与重置函数
│   │   │   ├── search-controller.ts  # 搜索防抖调度、当前匹配导航控制 (候选计算段已拆 computeSearchOutcome)
│   │   │   ├── replacement.ts        # 单个/批量替换业务编排与内核同步
│   │   │   ├── context-cache.ts      # 编辑器上下文与选区缓存
│   │   │   ├── document-snapshot.ts  # 文档内容快照缓存
│   │   │   ├── revision.ts           # 搜索/替换修订号守卫 (防过期结果回写)
│   │   │   ├── search-blocks.ts      # 可搜索块收集编排
│   │   │   ├── search-document-events.ts # 文档事件驱动的实时刷新监听
│   │   │   ├── search-pending-navigation.ts  # 异步跳转重试与高亮同步 (生命周期/直接/原生导航)
│   │   │   ├── approximate-scroll.ts # 近似滚动引擎 (自 pending-navigation 拆出)
│   │   │   ├── loaded-block-range.ts # loadedBlockRange 解析/缓存/纯函数 (同上拆出)
│   │   │   ├── search-pending-navigation-state.ts # 跳转重试进度状态
│   │   │   ├── search-session-state.ts   # 会话收尾状态 (关闭面板时的提交查询等)
│   │   │   ├── terminal-session.ts   # 终端搜索面板会话 (自 store.ts 收敛)
│   │   │   ├── extraction.ts         # 全库命中批量提取 (复制 Markdown/块引用)
│   │   │   ├── minimap-blocks.ts     # blockId→blockIndex 映射共享工具
│   │   │   └── ui-state.ts           # 面板位置、尺寸记忆与持久化
│   │   ├── attribute-view/           # 数据库属性视图 (Attribute View) 搜索
│   │   │   ├── index.ts              # 统一导出入口
│   │   │   ├── search-service.ts     # 属性视图搜索业务编排
│   │   │   ├── search-blocks.ts      # 属性视图块收集与元数据解析
│   │   │   ├── search-candidate-policy.ts # 候选单元格筛选策略
│   │   │   ├── search-candidates.ts  # 候选单元格数据采集 (渲染数据)
│   │   │   ├── search-dom-candidates.ts # 视口内 DOM 单元格快速采集 (行归一化已拆分)
│   │   │   ├── search-types.ts       # 属性视图专用类型定义
│   │   │   └── search-values.ts      # 属性视图单元格取值工具
│   │   ├── canvas/                   # 白板导图 (Canvas) 搜索与替换
│   │   │   ├── context.ts / types.ts / search-blocks.ts / decorations.ts / replacement.ts
│   │   ├── terminal/                 # 终端页面搜索适配
│   │   │   ├── adapter.ts            # 终端搜索结果到统一匹配模型的映射
│   │   │   └── registry.ts           # 终端搜索面板注册与门控
│   │   ├── ui/                       # 文档内搜索界面子组件与 hooks
│   │   │   ├── SearchToolbarRow.vue / ReplaceActionRow.vue / RegexHelpPanel.vue
│   │   │   ├── layout-constants.ts   # PANEL_MARGIN 与 clamp (面板/迷你地图共享)
│   │   │   ├── minimap-context.ts    # 迷你地图上下文解析
│   │   │   ├── minimap-layout.ts     # 迷你地图布局计算
│   │   │   ├── use-composed-input.ts # IME 组合输入处理 Hook
│   │   │   ├── use-panel-frame.ts    # 面板定位/拖拽/尺寸记忆 Hook
│   │   │   └── use-panel-minimap.ts  # 迷你地图联动 Hook
│   │   └── global/                   # 全库搜索与替换 (Dock 侧边栏)
│   │       ├── store.ts              # 桶式导出 (状态/导航/搜索动作三模块聚合)
│   │       ├── store/                # 全库搜索状态子模块 (对齐 store/ 模式)
│   │       │   ├── state.ts          # 响应式状态 + createInitial/reset 工厂 + UI 动作
│   │       │   ├── navigation.ts     # DOM 导航与高亮 (含跳转定时器链)
│   │       │   └── search-actions.ts # executeGlobalSearch + 触发型动作
│   │       ├── types.ts              # 全库搜索类型定义
│   │       ├── filter-utils.ts       # hasActiveGlobalFilters 共享谓词 (双实现漂移修复)
│   │       ├── dock-manager.ts       # 思源 Dock 挂载与焦点管理
│   │       ├── history-tab-manager.ts# 替换历史独立 Tab 挂载
│   │       ├── doc-aggregator.ts     # 全库结果聚合与排序 (跨块校验已拆 verifyCrossBlockMatch)
│   │       ├── replace-engine.ts     # 全库批量替换引擎与事务生成
│   │       ├── diff-builder.ts       # 替换差异计算 + recalculateDiffSummary 汇总重算
│   │       ├── transaction-history.ts# 替换事务历史记录与回退管理
│   │       ├── saved-presets.ts      # 搜索预设保存与加载
│   │       ├── export-utils.ts       # 结果导出 (Markdown/块引/嵌入 SQL)
│   │       ├── kernel-query.ts       # 基于 SQL / API 的批量内容检索
│   │       ├── query-parser.ts       # 高级查询解析器 (分词分类/OR 组装已拆分)
│   │       ├── pinyin-match.ts       # 拼音模糊匹配
│   │       ├── pinyin/               # 拼音词典与拼音检索引擎
│   │       └── ui/                   # 全库搜索 UI 组件
│   │           ├── GlobalSearchDockView.vue # 全库搜索主视图 (弹窗/Popover/Diff 编排已拆出)
│   │           ├── DocAggregateItem.vue     # 单文档匹配折叠项
│   │           ├── FilterPillsBar.vue       # 过滤标签栏
│   │           ├── PopupModalShell.vue      # 弹窗外壳 (遮罩/标题栏/关闭)
│   │           ├── ExportResultsModal.vue   # 批量导出弹窗
│   │           ├── PresetsModal.vue         # 常用预设管理弹窗
│   │           ├── DiffComparisonLines.vue  # 「- 原文 / + 替换」对比行共享组件
│   │           ├── VisualDiffModal.vue      # 替换前后对比浮层
│   │           ├── RegexHelpPopover.vue     # 全库搜索正则语法气泡
│   │           ├── SearchHelpPopover.vue    # 搜索语法帮助气泡
│   │           ├── ReplaceHistoryTabView.vue# 替换历史分屏页签视图
│   │           ├── use-hover-popover.ts     # hover 弹窗延迟开/关计时器 Hook
│   │           ├── use-batch-replace-diff.ts# 批量替换 Diff 弹窗编排 Hook
│   │           └── use-toggle-set.ts        # Set 折叠切换共享 Hook
│   ├── i18n/                         # 国际化语言包 (zh_CN.json, en_US.json)
│   └── types/                        # 全局 TypeScript 类型声明
├── tests/                            # 自动化测试套件 (99 文件 / 527 用例)
│   ├── helpers/                      # 共享测试工具层
│   │   ├── store-context-mocks.ts    # editor/search-engine/kernel 三层共享 mock
│   │   ├── store-context-state.ts    # flushRefresh/createDeferred/resetState
│   │   ├── store-context-lifecycle.ts# 拆分后 store 主题测试的统一生命周期
│   │   └── store-state.ts            # searchReplaceState 共享重置（字段超集）
│   ├── mocks/                        # siyuan API 全局 mock (vitest alias)
│   └── store-context-*.test.ts       # 原 5117 行单文件按主题拆分（core/selection-snapshot/
│                                     #   av-search/nav-retry/nav-approx/nav-containers/
│                                     #   replace/selection-cache）
├── docs/                             # 规范文档与方案设计
│   ├── refactor-plan.md              # 重构跟踪与验证计划（第 2 轮 RF-101~RF-114 全部完成）
│   ├── state-machine-fix-plan.md     # 隐式状态机修复计划（历史轮次，已完成）
│   └── project-structure.md          # 模块架构与文件职责映射（本文档）
├── scripts/                          # 发版与包校验脚本
└── package.json                      # 依赖与脚本配置
```

## 2. 核心模块与职责分工

### 2.1 插件生命周期与宿主集成 (`src/index.ts`, `src/lunaria-bus.ts`)
- **生命周期管控**：管理 `onload`、`onunload`、`uninstall`。
- **UI 挂载**：初始化顶部栏图标、全库搜索侧边栏 Dock、替换历史 Tab 以及文档内浮动替换面板。
- **快捷键系统**：监听全局键盘事件，联动思源内置 `keymap` 完成冲突检测与动态热键更新。
- **Lunaria 工具总线**：注册体与检索执行位于 `lunaria-bus.ts`，index.ts 仅编排 window 事件。

### 2.2 文档内搜索与替换 (`src/features/search-replace/`)
- **状态流转**：`store/state.ts` + `store/search-controller.ts` 实现防抖搜索、当前匹配光标滚动和跨块导航；候选计算段独立为 `computeSearchOutcome`。
- **DOM 操作与安全替换**：`editor/` 模块针对 Protyle WYSIWYG 树精确定位，在不破坏思源块属性（`data-node-id`）的前提下完成安全文本替换。装饰分三层：`decorations.ts`（class 装饰）、`match-scroll.ts`（滚动定位）、`text-highlight.ts`（CSS Highlight 注册表）。
- **长文档导航**：`store/search-pending-navigation.ts`（重试生命周期）+ `approximate-scroll.ts`（近似滚动引擎）+ `loaded-block-range.ts`（已加载范围解析与轮内缓存）。
- **终端适配**：终端分支收敛于 `store/terminal-session.ts` 会话对象。
- **多容器适配**：统一支持常规段落、代码块、数学公式块、表格单元格（`table-dom.ts`）、属性视图（`attribute-view/`）与导图白板（`canvas/`）。

### 2.3 全库搜索与批量替换 (`src/features/search-replace/global/`)
- **多维度检索**：普通文本、正则表达式、拼音首字母/全拼检索、多词逻辑组合与行内过滤语法。
- **状态分层**：`store/state.ts`（工厂 + UI 动作）、`store/search-actions.ts`（检索执行）、`store/navigation.ts`（DOM 高亮跳转），经 `store.ts` 桶式导出。
- **安全替换事务机制**：批量替换前通过 `diff-builder.ts` 生成变更预览（含 `recalculateDiffSummary` 重算），替换过程记录在 `transaction-history.ts` 中，防止误操作。

## 3. 测试套件组织 (`tests/`)

- **环境**：vitest 默认 `jsdom`，纯 node 测试以 `// @vitest-environment node` 反向标注（逐文件环境与重构前等价）。
- **共享层**：`tests/mocks/siyuan.ts`（API alias mock）+ `tests/helpers/`（store 主题测试的 mock/状态/生命周期，及 12 处 `resetState` 收敛后的共享超集）。
- **主题拆分**：`store-context-*.test.ts` 8 个文件承载原 54 个集成用例；大文件（match-scroll / attribute-view-search / current-block-highlight）内嵌主题 describe 支持 `-t` 定向运行。
- **运行方式**：`pnpm test`（全量）或 `pnpm test tests/<file>.test.ts`（定向）。

## 4. 质量保障与维护规范

- **自动化测试**：所有修改优先通过 `pnpm test` 验证，核心逻辑覆盖率 100%。
- **类型与规范**：`pnpm typecheck`（tsc --noEmit，noUnusedLocals 开启）+ `pnpm lint`（eslint --fix 可自动清理未用导入）。
- **构建与集市规范**：通过 `pnpm build` 进行产物打包，并执行 `verify-package.mjs` 校验 zip 格式与隐藏文件过滤。
