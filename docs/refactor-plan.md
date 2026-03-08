# 重构计划

## 1. 项目快照

- 生成日期：2026-03-08
- 范围：`siyuan-sou-easy` 仓库，首轮聚焦 `src/features/search-replace/`、`src/index.ts`、`src/App.vue`
- 目标：在不改变现有行为的前提下，降低搜索替换主流程的耦合度，拆清插件入口、编辑器 DOM 边界与面板交互职责，提升后续测试与维护效率
- 文档刷新目标：最终在获批条目完成后创建或刷新 `docs/project-structure.md`，并同步刷新 `README.md`
- 基线状态：工作区当前无额外本地改动；`pnpm test` 已通过，结果为 `17` 个测试文件、`49` 个测试全部通过

## 2. 架构与模块分析

| 模块 | 关键文件 | 当前职责 | 主要痛点 | 测试覆盖情况 |
| --- | --- | --- | --- | --- |
| 入口与生命周期 | `src/index.ts`, `src/main.ts` | 插件启动、平台判断、设置加载/保存、命令与顶栏注册、事件总线绑定、Vue 根实例挂载 | `src/index.ts` 同时承担生命周期、设置面板构建、快捷键冲突校验、命令同步，职责偏多，修改一个路径容易影响其他入口 | 已有 `tests/topbar-icon.test.ts`、`tests/plugin-editor-events.test.ts`、`tests/hotkey-setting-input.test.ts`，但设置同步与生命周期顺序仍偏间接 |
| 搜索替换主编排 | `src/features/search-replace/store.ts` | 响应式状态、打开/关闭面板、编辑器上下文回退、匹配刷新调度、替换当前/全部、面板位置持久化、实时刷新观察器 | 单文件集中管理状态、定时器、观察器、DOM 更新和错误状态，副作用路径多，局部修改风险高，是当前最强耦合点 | 已有 `tests/store-context.test.ts`、`tests/live-refresh.test.ts`，但替换流程、busy 保护和 UI 状态持久化仍缺少直测 |
| 编辑器 DOM 边界 | `src/features/search-replace/editor.ts` | 活动编辑器识别、块采集、文本范围映射、高亮同步、替换克隆生成 | 上下文识别、DOM 遍历、Range 映射、高亮回退和替换定位都在同一文件，逻辑密度高、复用边界不清 | 已有 `tests/editor-context-detection.test.ts`、`tests/current-block-highlight.test.ts`、`tests/replacement-offset.test.ts`，但块过滤与 code block 场景未单独覆盖 |
| 文本匹配算法 | `src/features/search-replace/search-engine.ts`, `src/features/search-replace/preserve-case.ts` | 关键字/正则匹配、整词判断、替换大小写保持 | 代码规模适中、职责已较集中，当前不是首要拆分对象 | 已有 `tests/search-engine.test.ts`、`tests/preserve-case.test.ts`，覆盖相对充足 |
| 设置、快捷键与类型边界 | `src/settings.ts`, `src/hotkeys.ts`, `src/features/search-replace/types.ts`, `src/types/*.d.ts` | 设置归一化、搜索选项派生、快捷键格式化/冲突比对、类型声明 | 本身较清晰，但入口文件对其编排逻辑较多，存在“工具清晰、调用方过重”的问题 | 已有 `tests/settings.test.ts`、`tests/hotkeys.test.ts`，覆盖相对稳定 |
| UI 与交互编排 | `src/App.vue`, `src/components/SiyuanTheme/*` | 面板模板、IME 输入处理、拖拽定位、焦点同步、状态展示 | `src/App.vue` 同时包含视图、拖拽、焦点、输入守卫与状态拼接，交互逻辑聚集，后续扩展难度上升 | 已有 `tests/panel-widget.test.ts`、`tests/ime-search-input.test.ts`，但拖拽边界与聚焦链路仍缺少直接测试 |

补充判断：`search-engine.ts`、`preserve-case.ts`、`settings.ts`、`hotkeys.ts` 当前职责相对单一，不建议在首轮重构中优先拆动，除非在获批条目执行过程中暴露出新的重复或边界问题。

## 3. 按优先级排序的重构待办

| ID | 优先级 | 模块/场景 | 涉及文件 | 重构目标 | 行为不变式 | 风险等级 | 重构前测试清单 | 文档影响 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RF-001 | P0 | 搜索替换主编排拆分 | `src/features/search-replace/store.ts`, `src/features/search-replace/store-state.ts`, `src/features/search-replace/store-context.ts`, `src/features/search-replace/store-ui-state.ts`, `src/features/search-replace/store-replace.ts`, `tests/store-actions.test.ts`, `tests/store-ui-state.test.ts` | 将状态读写、编辑器上下文解析、匹配刷新/观察器、替换流程、UI 状态持久化拆成边界清晰的内部模块，保留对外 API 形状 | 1. `openPanel` 只在查询为空且 `preloadSelection` 为真时预载选中文本；2. `closePanel` 必须清理高亮、observer、busy/error；3. 查询/选项/上下文变化仍触发刷新；4. `replaceCurrent`/`replaceAll` 仍在 DOM 更新后刷新并跳过不可替换命中；5. 面板位置仅在 `rememberPanelPosition` 为真时持久化 | 高 | - [x] 运行 `tests/store-context.test.ts`；- [x] 运行 `tests/live-refresh.test.ts`；- [x] 补充“替换当前/全部、busy 防重入、按块分组跳过不可替换范围”的定向测试；- [x] 补充“打开/关闭面板、预载选区、位置持久化开关”的定向测试 | `docs/project-structure.md` 需更新搜索替换内部模块图；`README.md` 需补充架构/测试说明 | done |
| RF-002 | P1 | 编辑器 DOM 边界拆分 | `src/features/search-replace/editor.ts`, `src/features/search-replace/editor-context.ts`, `src/features/search-replace/editor-blocks.ts`, `src/features/search-replace/editor-decorations.ts`, `src/features/search-replace/editor-replace.ts`, `src/features/search-replace/editor-constants.ts`, `tests/editor-block-collection.test.ts` | 将编辑器上下文识别、块采集、装饰高亮、Range/替换定位拆成聚焦模块，降低 DOM 细节对其他层的泄漏 | 1. 活动编辑器解析优先级保持不变；2. `collectSearchableBlocks` 仍按 `blockId` 去重并尊重 `includeCodeBlock`；3. 无 CSS Highlight 时仍保留块级 class 高亮回退；4. 跨多个文本节点的范围仍不可直接替换 | 中高 | - [x] 运行 `tests/editor-context-detection.test.ts`；- [x] 运行 `tests/current-block-highlight.test.ts`；- [x] 运行 `tests/replacement-offset.test.ts`；- [x] 补充“块过滤/去重/code block 开关”的定向测试 | `docs/project-structure.md` 需更新编辑器边界层职责；`README.md` 可补一段实现边界说明 | done |
| RF-003 | P1 | 插件入口与设置面板拆分 | `src/index.ts`, `src/plugin-commands.ts`, `src/plugin-settings.ts`, `tests/plugin-settings-sync.test.ts` | 将生命周期注册、设置项构建、快捷键冲突校验与命令热键同步拆开，缩小插件类体积 | 1. `onload` 顺序保持“加载设置 → 应用设置 → 初始化 UI → 注册入口/命令 → 绑定事件”；2. 快捷键冲突检查仍合并插件命令与 SiYuan keymap；3. 设置变更仍归一化、保存并同步命令热键 | 中 | - [x] 运行 `tests/topbar-icon.test.ts`；- [x] 运行 `tests/plugin-editor-events.test.ts`；- [x] 运行 `tests/hotkey-setting-input.test.ts`；- [x] 运行 `tests/settings.test.ts` 与 `tests/hotkeys.test.ts`；- [x] 补充“设置保存后命令热键同步”的定向测试 | `docs/project-structure.md` 需更新入口与设置职责；`README.md` 需同步开发/调试入口说明 | done |
| RF-004 | P2 | 面板交互逻辑从 `App.vue` 抽离 | `src/App.vue` | 将拖拽定位、窗口 resize 约束、焦点同步与 IME 输入守卫抽成可测试的 UI 辅助逻辑，减轻单文件复杂度 | 1. IME 组合输入期间不提前改写 query/replacement；2. 回车仍前进、`Shift+Enter` 仍后退；3. 仅非交互区域可触发拖拽；4. 位置仍被限制在视口内；5. 打开面板与展开替换栏后的焦点行为保持一致 | 中 | - [ ] 运行 `tests/panel-widget.test.ts`；- [ ] 运行 `tests/ime-search-input.test.ts`；- [ ] 补充“拖拽边界与持久化”的定向测试；- [ ] 视实现情况补充“面板打开后的焦点同步”测试 | `docs/project-structure.md` 需更新 UI 交互层；`README.md` 如用户可见行为未变则只做轻量说明 | pending |

优先级建议：

- 推荐先执行 `RF-001`，它是当前耦合最高、回归半径也最大的模块。
- 如 `RF-001` 完成稳定，再执行 `RF-002`，可以把 DOM 边界与主编排之间的接口一起收紧。
- `RF-003` 适合在核心链路稳定后进行，用于降低入口维护成本。
- `RF-004` 属于收益明确但风险较低的整理项，可放到最后。

## 4. 执行日志

| ID | 开始日期 | 结束日期 | 验证命令 | 结果 | 已刷新文档 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| BASELINE | 2026-03-08 | 2026-03-08 | `pnpm test` | pass（17 files / 49 tests） | 暂无 | 当前仅完成分析与计划编写，尚未开始任何重构 |
| RF-001 | 2026-03-08 | 2026-03-08 | `pnpm test -- tests/store-actions.test.ts tests/store-ui-state.test.ts tests/store-context.test.ts tests/live-refresh.test.ts`；`pnpm test` | pass（19 files / 56 tests） | 待最终统一刷新 | 已将 store 内部职责拆为状态、上下文、持久化、按块替换 4 个内部模块，并补充 2 组 store 回归测试 |
| RF-002 | 2026-03-08 | 2026-03-08 | `pnpm test -- tests/editor-block-collection.test.ts tests/editor-context-detection.test.ts tests/current-block-highlight.test.ts tests/replacement-offset.test.ts`；`pnpm test` | pass（20 files / 58 tests） | `docs/project-structure.md`、`README.md` | 已将 editor 内部职责拆为上下文、块采集、装饰、高亮常量、替换 5 个内部模块，并补充块采集回归测试 |
| RF-003 | 2026-03-08 | 2026-03-08 | `pnpm test -- tests/plugin-settings-sync.test.ts tests/topbar-icon.test.ts tests/plugin-editor-events.test.ts tests/hotkey-setting-input.test.ts tests/settings.test.ts tests/hotkeys.test.ts`；`pnpm test` | pass（21 files / 60 tests） | `docs/project-structure.md`、`README.md` | 已将命令/事件注册与设置面板逻辑拆到 `plugin-commands.ts`、`plugin-settings.ts`，并补充设置保存后的命令热键同步测试 |

## 5. 决策与确认

- 用户批准的条目：`RF-001`、`RF-002`（于 2026-03-08 批准）；`RF-003`（于 2026-03-08 追加批准）
- 延后的条目：`RF-003`、`RF-004`
- 阻塞条目及原因：暂无

## 6. 文档刷新范围

- `docs/project-structure.md`：已刷新，补充插件入口 helper、测试映射与最新职责划分
- `README.md`：已刷新，补充入口 helper 模块说明，并保持开发命令为 `pnpm`
- 最终同步检查：done

## 7. 下一步

1. 获批条目 `RF-001`、`RF-002`、`RF-003` 已全部完成
2. 如需继续推进，可按原计划再审批 `RF-004`
3. 当前仓库文档与测试状态已同步到最新结构
