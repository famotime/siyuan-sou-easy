# 重构计划

## 1. 项目快照

- 生成日期：2026-03-29
- 范围：`siyuan-sou-easy` 插件代码库
- 目标：在不改变现有搜索、替换、设置和面板交互行为的前提下，继续降低高复杂模块的耦合度，补齐高风险路径的测试防线，并为后续文档同步建立清晰边界
- 文档刷新目标：`docs/project-structure.md`、`README.md`
- 当前仓库状态说明：存在未提交改动 `package.json`、`plugin.json`、`package.zip`，本轮计划不触碰这些文件

## 2. 架构与模块分析

| 模块 | 关键文件 | 当前职责 | 主要痛点 | 测试覆盖情况 |
| --- | --- | --- | --- | --- |
| 插件入口与设置装配 | `src/index.ts`, `src/main.ts`, `src/settings.ts`, `src/features/search-replace/plugin-settings-ui.ts`, `src/features/search-replace/plugin-command-config.ts` | 插件生命周期、前端环境判断、顶栏入口、命令注册、快捷键捕获、设置面板渲染与持久化 | `src/index.ts` 仍承担过多编排职责；生命周期、快捷键冲突检测、面板切换决策、设置提交逻辑耦合在一个类中，后续加入口或设置项时仍要横跨多处修改 | 覆盖较好：`tests/plugin-command-hotkeys.test.ts`、`tests/plugin-settings-panel.test.ts`、`tests/settings.test.ts`、`tests/default-hotkeys.test.ts`、`tests/hotkey-setting-input.test.ts` |
| 搜索会话编排 | `src/features/search-replace/store.ts`, `src/features/search-replace/store/search-controller.ts`, `src/features/search-replace/store/context-cache.ts`, `src/features/search-replace/store/document-snapshot.ts`, `src/features/search-replace/store/replacement.ts` | 响应式状态、编辑器上下文缓存、选区模式、刷新调度、懒加载导航、替换流程、文档快照回退 | `search-controller.ts` 仍是核心风险点，混合了事件监听、观察器管理、定时器、导航恢复、快照回退和错误态维护；行为不变量主要靠隐式约定维持，新增刷新策略或导航策略时回归风险高 | 覆盖较强：`tests/live-refresh.test.ts`、`tests/store-context.test.ts`、`tests/store-replace-all.test.ts`、`tests/selection-mode-panel.test.ts`；缺少对待导航重试、监听器解绑和异常快照回退的更细粒度断言 |
| 属性视图搜索管线 | `src/features/search-replace/attribute-view-search.ts`, `src/features/search-replace/kernel.ts`, `src/features/search-replace/match-utils.ts`, `src/features/search-replace/types.ts` | 识别属性视图块、提取 DOM 候选项、API 渲染回退、值类型归一化、拼装预览文本与不可替换匹配 | `attribute-view-search.ts` 体量最大且职责最杂，DOM 抓取、接口回退、值类型解析、时间格式化和预览组装混在同一文件；一旦思源属性视图结构变化，定位问题和补丁范围都会扩大 | 仅有基础覆盖：`tests/attribute-view-search.test.ts` 主要覆盖 DOM 回退路径；API 渲染行列、复杂值类型、`custom-avs` 解析和多来源候选合并仍有明显空白 |
| 面板 UI 与迷你地图 | `src/App.vue`, `src/features/search-replace/ui/use-panel-minimap.ts`, `src/features/search-replace/ui/use-panel-frame.ts`, `src/features/search-replace/ui/use-composed-input.ts` | 搜索/替换面板渲染、IME 输入保护、拖拽与缩放、迷你地图投影、滚动同步和视口展示 | `use-panel-minimap.ts` 既做数据投影又做滚动控制和监听器绑定；几何计算较多、局部状态多，和 `App.vue` 的 watcher 配合关系不够显式，后续加交互容易出现滚动漂移类回归 | 覆盖较好：`tests/minimap-widget.test.ts`、`tests/panel-widget.test.ts`、`tests/panel-i18n.test.ts`、`tests/ime-search-input.test.ts`；缺少对投影算法和容器切换逻辑的纯函数级验证 |
| 编辑器 DOM 适配与装饰 | `src/features/search-replace/editor/blocks.ts`, `src/features/search-replace/editor/selection.ts`, `src/features/search-replace/editor/decorations.ts`, `src/features/search-replace/editor/ranges.ts` | 可搜索块采集、选区映射、文本节点定位、命中高亮与滚动定位 | DOM 规则分散，块边界、文本所有权和装饰定位规则耦合在多个文件中；虽然已有前期整理，但 `decorations.ts` 仍较大，后续修改高亮或滚动逻辑时阅读成本高 | 覆盖中等偏好：`tests/editor-block-collection.test.ts`、`tests/selection-scope.test.ts`、`tests/current-block-highlight.test.ts`、`tests/match-scroll.test.ts` |

## 3. 按优先级排序的重构待办

| ID | 优先级 | 模块/场景 | 涉及文件 | 重构目标 | 行为不变式与风险 | 重构前测试清单 | 文档影响 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RF-101 | P0 | 搜索控制器生命周期拆分 | `src/features/search-replace/store/search-controller.ts`, `src/features/search-replace/store.ts`, `src/features/search-replace/store/context-cache.ts`, `src/features/search-replace/store/document-snapshot.ts` | 将监听器绑定、待导航恢复、实时刷新观察器、上下文解析和块解析回退拆成职责更单一的协作者或内部模块，缩小 `search-controller.ts` 的状态面 | 不改变当前公开 store API；不改变被动刷新时不自动滚回当前命中；不改变选区模式失效时的错误提示；风险高，因为它直接影响最常用的搜索刷新链路 | - [ ] 运行 `tests/live-refresh.test.ts`，覆盖 DOM 变更刷新和被动刷新不抢滚动<br>- [ ] 运行 `tests/store-context.test.ts`，覆盖上下文切换与文档缺失提示<br>- [ ] 运行 `tests/selection-mode-panel.test.ts`，覆盖选区模式缓存/清空<br>- [ ] 补充待导航重试、监听器解绑、快照回退异常的定向测试 | `docs/project-structure.md` 需要更新 store 子模块职责；`README.md` 通常无用户可见变更，除非重构顺带暴露新的稳定性说明 | pending |
| RF-102 | P0 | 属性视图搜索管线分层 | `src/features/search-replace/attribute-view-search.ts`, `src/features/search-replace/kernel.ts`, `src/features/search-replace/types.ts`, 可能新增 `src/features/search-replace/attribute-view/*` | 将属性视图块发现、DOM 候选抽取、API 渲染回退、值归一化、预览组装拆开，建立清晰的输入输出边界，降低思源属性视图结构变动带来的修复成本 | 不改变属性视图命中是否可替换的判定；不改变现有预览文本格式；不改变 block index 排序和匹配 id 规则；风险高，因为当前测试主要覆盖 DOM 回退路径，接口路径回归不易被第一时间发现 | - [ ] 运行 `tests/attribute-view-search.test.ts` 作为回归基线<br>- [ ] 新增 API 渲染 rows/columns 路径测试<br>- [ ] 新增复杂值类型解析测试：`date`、`relation`、`rollup`、`mAsset`、`number`<br>- [ ] 新增 `custom-avs` / `custom-sy-av-view` 解析测试和多来源候选合并测试 | `docs/project-structure.md` 需要新增属性视图子模块说明；`README.md` 如对外能力描述涉及“搜索属性视图”，需同步说明实现边界和稳定能力 | pending |
| RF-103 | P1 | 迷你地图投影与滚动控制解耦 | `src/features/search-replace/ui/use-panel-minimap.ts`, `src/App.vue`, 可能新增 `src/features/search-replace/ui/minimap-*.ts` | 把几何投影、点击滚动目标计算、视口投影和监听器绑定拆开，让迷你地图主要保留组合逻辑，便于单测和后续扩展 | 不改变现有迷你地图显示条件；不改变点击跳转和懒加载后视口跟踪；风险中等，主要是滚动位置和视口框易出现细微回归 | - [ ] 运行 `tests/minimap-widget.test.ts`，覆盖标记、视口、点击跳转和滚动高度变化<br>- [ ] 运行 `tests/panel-widget.test.ts`，确认面板与迷你地图共存交互不变<br>- [ ] 补充纯函数级投影/夹取逻辑测试，避免只依赖组件挂载用例 | `docs/project-structure.md` 需要更新 UI composable 切分；`README.md` 仅在用户可见行为调整时更新截图或描述 | pending |
| RF-104 | P1 | 插件入口编排收束 | `src/index.ts`, `src/settings.ts`, `src/features/search-replace/plugin-settings-ui.ts`, `src/features/search-replace/plugin-command-config.ts`, 可能新增 `src/features/search-replace/plugin-bootstrap.ts` | 继续压缩入口类的职责，把环境识别、命令回调装配、设置变更应用和冲突检测组织成更稳定的数据驱动结构 | 不改变已有命令 ID、快捷键同步规则、顶栏入口和设置项展示顺序；风险中等，主要是注册时序和输入捕获行为 | - [ ] 运行 `tests/plugin-command-hotkeys.test.ts`<br>- [ ] 运行 `tests/plugin-settings-panel.test.ts`<br>- [ ] 运行 `tests/settings.test.ts`、`tests/default-hotkeys.test.ts`、`tests/hotkey-setting-input.test.ts`<br>- [ ] 如拆出新的装配模块，补一组设置变更同步测试 | `docs/project-structure.md` 需要更新入口层结构；`README.md` 通常仅在开发说明或快捷键说明有变化时更新 | pending |
| RF-105 | P2 | 编辑器装饰与块规则一致性清理 | `src/features/search-replace/editor/decorations.ts`, `src/features/search-replace/editor/blocks.ts`, `src/features/search-replace/editor/ranges.ts`, `src/features/search-replace/editor/selection.ts` | 在已有块采集整理基础上，再统一高亮定位和 DOM 边界规则，减少装饰/滚动逻辑对分散 helper 的隐式依赖 | 不改变命中高亮样式、当前块高亮和滚动定位结果；风险中等偏低，但 DOM 细节多，局部回归难肉眼发现 | - [ ] 运行 `tests/editor-block-collection.test.ts`<br>- [ ] 运行 `tests/selection-scope.test.ts`<br>- [ ] 运行 `tests/current-block-highlight.test.ts`、`tests/match-scroll.test.ts`<br>- [ ] 如抽出共享定位 helper，补边界位置与跨节点范围测试 | `docs/project-structure.md` 需要更新 editor 子模块职责；`README.md` 通常无用户文案变更 | pending |

优先级说明：
- `P0`：价值高且风险高，先补测试再动实现
- `P1`：中等风险或中等价值，放在 `P0` 之后
- `P2`：清理与一致性优化，最后处理

状态说明：
- `pending`
- `in_progress`
- `done`
- `blocked`

## 4. 执行日志

| ID | 开始日期 | 结束日期 | 验证命令 | 结果 | 已刷新文档 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| RF-101 |  |  |  |  |  |  |
| RF-102 |  |  |  |  |  |  |
| RF-103 |  |  |  |  |  |  |
| RF-104 |  |  |  |  |  |  |
| RF-105 |  |  |  |  |  |  |

## 5. 决策与确认

- 用户批准的条目：
- 延后的条目：
- 阻塞条目及原因：

## 6. 文档刷新

- `docs/project-structure.md`：当前仓库中尚不存在；获批重构范围完成后需要新建或补齐为真实结构映射文档
- `README.md`：当前内容偏用户功能简介；若获批重构涉及模块结构、开发说明或稳定性表述，需要同步更新
- 最终同步检查：待执行后填写

## 7. 下一步

1. 用户按条目 ID 明确批准本轮要执行的重构项。
2. 对每个获批条目先补测试或调整现有测试，再开始代码重构。
3. 每完成一项立即回写本文件状态和验证命令，最后刷新 `docs/project-structure.md` 与 `README.md`。
