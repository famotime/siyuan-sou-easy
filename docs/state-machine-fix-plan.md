# 隐式状态机分析与修复计划

## 1. 项目快照

- 生成日期：2026-11-19
- 范围：`siyuan-sou-easy` 全部源码（`src/` 约 60 个文件、约 13000 行）与测试基础设施
- 方法：静态精读（store/、global/、editor/、canvas/、attribute-view/、terminal/、UI 组件、插件生命周期）+ 三路并行专项扫描
- 目标：识别所有"隐式状态机"（未建模为枚举、而由布尔标志/计数器/定时器/deadline/DOM 探测承载的状态），暴露其隐藏问题，逐项修复并补全测试

## 2. 隐式状态机清单（按子系统）

本项目没有正式建模的状态机，全部状态由约 30 个隐式机制承载。成熟度差异显著：文档内搜索主线严谨（generation token + 有界重试 + 对称监听器配对），全库搜索侧缺少对等防护。

| # | 状态机 | 状态载体 | 位置 | 成熟度评价 |
| --- | --- | --- | --- | --- |
| 1 | 文档内搜索会话 | `visible/replaceVisible/minimapVisible`、`query` vs `committedQuery`、`busy/searching/documentReadonly` 3 布尔 | `store/state.ts` | 良好；3 布尔组合 8 态实际只用 5 态 |
| 2 | 防抖搜索调度 | `latestRefreshRevision`（generation token）+ `refreshTimer` + `pendingQueryIndex` | `store/search-controller.ts` | 优秀，全库侧应以此为模板 |
| 3 | 待处理导航（分层 FSM） | `pendingNavigationMatchId/retryCount/timer` ⊃ 4 个子状态：折叠展开 Set、directNavigationProgress（start/progress/wait/fallback）、native deadline（1500ms）、approximate 边界计数（40/200 attempts） | `store/search-pending-navigation.ts` + `search-pending-navigation-state.ts` | 有界放弃条件完备；存在 begin 不清 timer、unfold 无超时等缝隙 |
| 4 | 编辑器上下文缓存 | `lastEditorContext/lastHinted/lastSelectionScope(rootId)` + 7 级解析优先级链 | `store/context-cache.ts`、`editor/context.ts` | 两层失效机制自洽 |
| 5 | 文档快照缓存 | 单槽 `snapshotCache(rootId+includeCodeBlock)` + 事件失效 | `store/document-snapshot.ts` | 良好 |
| 6 | 文档事件监听 | `documentListenersBound`、MutationObserver 目标切换、canvas subscribe、`selectionRevealTimer` | `store/search-document-events.ts` | 良好（面板关闭期间监听仍活跃，性能成本） |
| 7 | 文本高亮缓存 | 模块级 `textHighlightCache`（引用相等 + Range 连通性失效） | `editor/decorations.ts` | **失效谓词有漏洞（SM-001）** |
| 8 | 全局文本高亮注册表 | `CSS.highlights` document 级单例槽 ×2 | `editor/decorations.ts` | 与按 protyle 清理不对称（SM-013） |
| 9 | 全库搜索会话 | `query` vs `searchedQuery`、`searching` 布尔、`results` | `global/store.ts` | **无 revision 防护（SM-003）** |
| 10 | 批量替换执行 | 批次循环（15/批 + 50ms）+ 进度回调 | `global/replace-engine.ts` | 无取消令牌（SM-008） |
| 11 | 替换事务/回退 | `transactionsMemoryCache` + `reverted` 布尔 + `revertingId`（视图层） | `global/transaction-history.ts` | 跨视图并发无防护（SM-024） |
| 12 | Dock 可见性 | 纯 DOM 探测（offsetParent/activeElement/querySelector） | `global/dock-manager.ts` | 4 态状态空间只处理 3 态（SM-006） |
| 13 | 面板拖拽/缩放 | `dragState/resizeState`（互斥）+ pointer 监听配对 | `ui/use-panel-frame.ts` | 优秀 |
| 14 | 迷你地图同步 | `minimapScrollTarget`（条件释放）+ 滚动容器换绑 | `ui/use-panel-minimap.ts` | 良好 |
| 15 | 弹窗/Popover 组 | hover 定时器对、`executing`、expanded/collapsed Set | `global/ui/*.vue`、`App.vue` | 个别定时器卸载未清（SM-023） |
| 16 | IME 组合 | 每输入一份 `isComposing` | `ui/use-composed-input.ts` | 良好 |
| 17 | 插件生命周期 | `pluginInstance` 存活开关、`app/hostElement`、设置内存↔磁盘双真值、热键三通道 | `index.ts`、`main.ts`、`plugin-instance.ts` | 多处缝隙（SM-007/017/018/020/026） |
| 18 | 持久化防抖 | `persistTimer`（180ms）+ 无 flush | `store/ui-state.ts` | 卸载丢最后一次写（SM-017） |
| 19 | 预设缓存 | `presetsCache` + load 整体覆盖 | `global/saved-presets.ts` | 读写竞态（SM-015） |
| 20 | 历史页签 app 表 | `WeakMap<HTMLElement, VueApp>` | `global/history-tab-manager.ts` | 重复 init 泄漏（SM-016） |
| 21 | 原生导航去重 | 调用方私有 `attemptedMatchId + deadline` | `native-navigation.ts` + 控制器 | sourceKind 过滤不全（SM-011） |
| 22 | RegExp 游标 | `pattern.lastIndex`（每块重置） | `search-engine.ts` | 当前正确，脆弱性已注释固化 |

## 3. 问题与修复条目

### 3.1 修复条目（本轮执行）

| ID | 优先级 | 问题 | 涉及文件 | 修复方向 | 风险 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| SM-001 | P0 | 高亮缓存失效谓词漏检原地文本编辑：编辑器输入后、防抖刷新完成前导航/替换会以同引用命中过期缓存，"当前匹配"高亮落在错误文本 | `editor/decorations.ts` | 缓存复用前逐 match 校验 `range.toString()` 与 `matchedText` 一致 | 低 | pending |
| SM-002 | P0 | 事务回退兜底引用不存在的 `item.originalContent`（会把 `undefined` 写进文档）；replace-engine 拿不到 DOM 时伪造段落 `originalDom`，回退将覆盖块真实结构 | `global/transaction-history.ts`、`global/replace-engine.ts` | 删除伪造兜底与幽灵字段路径：无真实 `originalDom` 的事务项禁止回退、原块记为 skipped | 低 | pending |
| SM-003 | P1 | `executeGlobalSearch` 无 revision 过期防护：连续搜索竞态覆盖、spinner 提前消失、结果与输入框错位 | `global/store.ts` | 新建 `store/revision.ts` 统一 revision guard 并接入 | 低 | pending |
| SM-004 | P1 | `replaceCurrentMatch` 的 busy 互斥存在 TOCTOU 窗口（await 后才置位），快速双击并发替换 | `store/replacement.ts` | busy 在任何 await 之前同步置位（`withBusy` 原语） | 低 | pending |
| SM-005 | P1 | `replaceAllMatches` 在事务提交前累加计数，事务失败仍提示"替换成功 N 处" | `store/replacement.ts` | 事务提交成功后再计数，失败给出明确错误 | 低 | pending |
| SM-006 | P1 | Dock 热键在"可见-激活-未聚焦"态点击已激活 tab → 面板被误关而非聚焦 | `global/dock-manager.ts` | 维护显式 JS 可见状态，处理第四态（聚焦而非点击） | 中 | pending |
| SM-007 | P1 | `globalSearchHotkey` 修改后命令通道（`openGlobalSearch`）不同步，旧热键成幽灵热键 | `plugin-command-config.ts` | `syncPanelCommandHotkeys` 纳入 `openGlobalSearch` 命令；dock `config.hotkey` 无法热更新，文档注明重载生效 | 低 | pending |
| SM-008 | P1 | `executeBatchReplace` 不可取消，插件卸载后仍继续写内核 | `global/replace-engine.ts` | 接入 revision guard 作为取消令牌，批次间与块间检查 | 低 | pending |
| SM-009 | P1 | `replaceTextInDom` 对整段 HTML 裸字符串替换：`$&`/`$'` 被二次解释、匹配文本出现在属性中会改坏属性、同块多次出现盲替换首处 | `global/replace-engine.ts` | 函数替换器消除 `$` 解释；仅替换首个文本内容位置并校验结果；无匹配时记为 skipped | 中 | pending |
| SM-010 | P2 | AV 搜索循环不可取消（过期循环打满内核 API）、`blocks.push` 在成功前、`catch` 静默 | `attribute-view/search-service.ts`、`store/search-controller.ts` | 传入 `isStale` 回调每轮检查；push 移入成功分支；catch 记录 debug 日志 | 低 | pending |
| SM-011 | P2 | `canTriggerNativeMatchNavigation` 未过滤 `terminal`/`canvas` 合成块 id，假 id 可经 `openTab(removeCurrentTab:true)` 打开并移除当前页签 | `native-navigation.ts` | sourceKind 白名单（仅真实 protyle 块） | 低 | pending |
| SM-012 | P2 | `beginPendingNavigation` 不清旧重试定时器（双链交错计数）；unfold Promise 链无超时（hint 卡死）；`void .then()` 无 catch | `store/search-pending-navigation.ts` | begin 首行 clearTimeout；unfold 加超时竞速；then 链补 catch | 低 | pending |
| SM-013 | P2 | `clearSearchDecorations(context)` 无条件删除 document 级全局文本高亮，擦掉其他编辑器正在显示的高亮 | `editor/decorations.ts` | 缓存归属不属于当前 context 时跳过全局高亮清除 | 低 | pending |
| SM-014 | P2 | 表格当前匹配在当前文本高亮注册失败时，单元格 class、块 class、文本强调三者全空，"当前"标识静默丢失 | `editor/decorations.ts` | 以 `applyCurrentTextHighlight` 返回值门控 `usesTableTextHighlight`，失败回退块级 class | 低 | pending |
| SM-015 | P2 | 预设缓存读写竞态：`savePreset` await 期间重开菜单触发 load 磁盘旧态覆盖缓存，新预设消失并被固化丢失 | `global/saved-presets.ts` | dirty 标志：缓存脏时 load 跳过磁盘覆盖 | 低 | pending |
| SM-016 | P2 | `initReplaceHistoryTab` 重复初始化时旧 Vue app 从不 unmount（对照组 dock-manager 有正确先卸载） | `global/history-tab-manager.ts` | 重建前卸载 WeakMap 中旧 app | 低 | pending |
| SM-017 | P2 | 卸载期持久化静默丢失：`unbindUiStatePlugin` 直接 clearTimeout 不 flush；`setPluginInstance(null)` 后 in-flight 写盘静默丢弃；`applyPluginSettings` 在 `bindUiStatePlugin` 之前执行导致清盘写入丢失 | `store/ui-state.ts`、`index.ts`、`store.ts` | 提供 `flushPendingUiState()` 于卸载路径 await；onload 先 init 再 applyPluginSettings | 低 | pending |
| SM-018 | P2 | `uninstall()` 未清理 `saved_searches.json`（含搜索历史）与 `replace_transactions.json` | `index.ts` | 卸载时补删两类存储 | 低 | pending |
| SM-019 | P2 | 设置复选框 onChange 的 rejection 无人捕获、写盘失败无视觉回退（颜色/数字输入有 `accepted` 反馈，复选框独缺） | `plugin-setting-elements.ts` | onChange 契约升级为返回 boolean，失败回退 checked 并捕获 rejection | 低 | pending |
| SM-020 | P3 | `destroy()` 不复位会话状态，禁用再启用后查询词/替换词跨生命周期存活 | `main.ts` | 卸载路径调用 `resetSearchReplaceState()` | 低 | pending |
| SM-021 | P3 | `persistTransactions` 仅磁盘截断 50 条，内存缓存无界增长 | `global/transaction-history.ts` | 记录时同步截断内存缓存 | 低 | pending |
| SM-022 | P3 | `scrollAndHighlightTableRow` 等定时器链无取消句柄，卸载后仍执行 | `global/store.ts`、`global/dock-manager.ts` | 定时器句柄集中登记，Dock 销毁时统一清除 | 低 | pending |
| SM-023 | P3 | Dock 视图 `hideHelpTimer` 卸载未清理 | `global/ui/GlobalSearchDockView.vue` | onUnmounted 补清 | 低 | pending |
| SM-024 | P2 | 双历史视图（Drawer/Tab）并发回退无互斥、`reverted` 状态各自为政 | `global/transaction-history.ts` | revertTransaction 模块级 in-flight 互斥；并发调用返回"回滚进行中" | 低 | pending |
| SM-025 | P3 | `fetchNotebooks` 用 `LIMIT 500` SQL 采样且笔记本名显示为 box id | `global/kernel-query.ts` | 改用内核 `lsNotebooks` API（以 siyuan-note 源码核对） | 中 | pending |
| SM-026 | P3 | window capture Escape 拦截先于热键捕获框检查，捕获框内按 Escape 无法取消捕获反而关闭面板 | `index.ts` | `isHotkeyCaptureTarget` 检查前移 | 低 | pending |

### 3.2 已识别但本轮不修复（记录原因）

| 问题 | 原因 |
| --- | --- |
| 平滑滚动乐观返回 `'scrolled'`、canvas `reveal` 丢弃 Promise | pending-navigation 重试循环以 120ms 轮询 + `isMatchVisible` 已兜底动画收敛；改变返回语义影响面大 |
| `CSS.highlights` 按编辑器分槽 | `::highlight()` 选择器为静态 CSS 规则，分槽需动态样式注入，重构范围过大；SM-013 以最小修复缓解 |
| `hpath LIKE '%x%'` 为包含而非前缀匹配 | 语义变更会影响现有用户搜索预期，需产品决策 |
| 多窗口下事务文件 last-writer-wins | 架构级问题（需内核侧协调），单窗口场景无影响 |
| 选区缓存回退到过期 scope（caret 塌陷时） | 现有行为可能为有意设计（保持选区内搜索模式），需产品确认 |
| `context-cache` 面板关闭期间 document 监听持续工作 | 性能成本而非正确性问题，已有活性校验兜底 |
| terminal 适配器 currentIndex 双事实源 | 外部 surface 契约所限，风险低 |
| i18n 卸载尾部回退中文、z-index 一次性快照 | 边缘场景，无正确性影响 |

## 4. 提交划分

| 批次 | 条目 | 提交主题 |
| --- | --- | --- |
| A | SM-001, SM-013, SM-014 | fix(decorations): 高亮缓存内容指纹与清除范围修正 |
| B | SM-002, SM-021 | fix(global): 替换事务回退安全化与内存截断 |
| C | SM-003, SM-010 | feat(store): 统一 revision 过期防护接入全库搜索与属性视图检索 |
| D | SM-004, SM-005 | fix(store): 替换动作 busy 同步互斥与事务成功计数修正 |
| E | SM-008, SM-009 | fix(global): 批量替换取消令牌与 DOM 替换安全化 |
| F | SM-011, SM-012 | fix(navigation): 原生导航 sourceKind 白名单与 pending-navigation 生命周期修补 |
| G | SM-006, SM-007 | fix(dock): dock 显式可见状态与热键命令通道同步 |
| H | SM-015..SM-018, SM-020 | fix(lifecycle): 卸载刷写、uninstall 清理补全、历史 Tab 泄漏与状态复位 |
| I | SM-019, SM-022..SM-024, SM-025, SM-026 | fix(ui): 设置反馈、定时器清理、回退互斥与杂项修正 |
| J | 文档 | docs: 刷新修复状态与执行日志 |

## 5. 执行日志

| ID | 开始日期 | 结束日期 | 验证命令 | 结果 | 备注 |
| --- | --- | --- | --- | --- | --- |
| （待填写） | | | | | |

## 6. 状态说明

- `pending`：待执行
- `in_progress`：执行中
- `done`：已完成并验证
- `blocked`：受阻（注明原因）
- `wontfix`：已识别但决定不修（见 3.2）
