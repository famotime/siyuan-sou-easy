# 重构计划

## 1. 项目快照

- 生成日期：2026-10-23
- 范围：`siyuan-sou-easy` 核心代码库（`src/` 与 `tests/`）
- 目标：清理历史废弃死代码文件、收敛模块结构、消除测试告警与状态重置缺陷、优化主入口与核心服务组织，并建立完整的项目架构文档。
- 文档刷新目标：`docs/project-structure.md`、`README.md`、`AGENTS.md`

## 2. 架构与模块分析

| 模块 | 关键文件 | 当前职责 | 主要痛点 | 测试覆盖情况 |
| --- | --- | --- | --- | --- |
| 插件入口与生命周期 | `src/index.ts`<br>`src/plugin-*.ts`<br>`src/settings.ts` | 插件初始化、快捷键绑定、Dock与Tab注册、设置面板装配 | 根目录下残留老旧未引用的 `src/plugin-commands.ts` 与 `src/plugin-settings.ts`，造成维护混淆；`index.ts` 略显臃肿 | 覆盖充分（`tests/plugin-*.test.ts` 等多套集成测试通过） |
| 历史遗留孤立平铺代码 | `src/features/search-replace/editor-*.ts`<br>`src/features/search-replace/store-*.ts` | 旧版编辑器与状态逻辑实现 | 完全已被 `editor/` 和 `store/` 子目录下的模块取代，但留在根目录下未删除，无任何生产代码引用，极易导致检索和维护误判 | 无独立有效引用，全量测试未直接使用 |
| 文档搜索替换状态管理 | `src/features/search-replace/store.ts`<br>`src/features/search-replace/store/state.ts` | 响应式状态容器、面板状态与控制器连接 | 状态重置未对外暴露标准化重置函数，测试中存在错误的重置代码（读取不存在的配置项），引发 Vue prop 警告 | 覆盖完善（`tests/store-context.test.ts` 等），但部分测试重置状态时有缺陷 |
| 属性视图搜索服务 | `src/features/search-replace/attribute-view-search.ts`<br>`src/features/search-replace/attribute-view/*` | 搜寻数据库属性视图（Attribute View）单元格并生成匹配项 | `attribute-view-search.ts` 孤立在 `features/search-replace/` 根目录，未与 `attribute-view/` 子模块目录归整 | `tests/attribute-view-search.test.ts` 覆盖完善 |
| 测试套件与语法规范 | `tests/store-context.test.ts`<br>`tests/canvas-*.test.ts`<br>`tests/mobile-ui.test.ts` | 自动化测试套件 | 部分测试用例存在重复键名字面量语法告警（`Duplicate key "occ"`）；mobile UI 测试中存在 undefined prop 警告 | 431 个测试通过，但运行时存在警告日志 |

## 3. 按优先级排序的重构待办

| ID | 优先级 | 模块/场景 | 涉及文件 | 重构目标 | 风险等级 | 重构前测试清单 | 文档影响 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RF-001 | P0 | 清理历史废弃孤立文件（Dead Code Cleanup） | `src/plugin-commands.ts`<br>`src/plugin-settings.ts`<br>`src/features/search-replace/editor-blocks.ts`<br>`src/features/search-replace/editor-constants.ts`<br>`src/features/search-replace/editor-context.ts`<br>`src/features/search-replace/editor-decorations.ts`<br>`src/features/search-replace/editor-replace.ts`<br>`src/features/search-replace/store-context.ts`<br>`src/features/search-replace/store-replace.ts`<br>`src/features/search-replace/store-state.ts`<br>`src/features/search-replace/store-ui-state.ts` | 删除 11 个旧版残留且无生产依赖的孤立文件，彻底消除同名实现造成的代码混淆 | 中 | - [x] 运行 `pnpm test` 验证全量基线通过<br>- [x] 静态扫描确认项目中无上述文件外部引用<br>- [x] 运行 `pnpm build` 确认打包无缺失依赖 | `docs/project-structure.md`：移除已废弃文件清单 | done |
| RF-002 | P0 | 统一状态初始化与重置机制（State Reset & Helper Consolidation） | `src/features/search-replace/store/state.ts`<br>`src/features/search-replace/store.ts`<br>`tests/mobile-ui.test.ts` | 在 `store/state.ts` 导出标准的 `createInitialSearchReplaceState` 与 `resetSearchReplaceState`；修复 `tests/mobile-ui.test.ts` 中非法的属性重置逻辑，消除 Vue prop 类型告警 | 低 | - [x] 跑 `tests/store-ui-state.test.ts`<br>- [x] 跑 `tests/mobile-ui.test.ts`，验证测试通过且 Vue warn 消失 | `docs/project-structure.md`：更新状态管理模块说明 | done |
| RF-003 | P1 | 属性视图搜索模块路径与导出结构归整 | `src/features/search-replace/attribute-view-search.ts`<br>`src/features/search-replace/attribute-view/search-service.ts`<br>`src/features/search-replace/attribute-view/index.ts`<br>`src/features/search-replace/store/search-controller.ts`<br>`tests/attribute-view-search.test.ts` | 将 `attribute-view-search.ts` 移入 `attribute-view/` 子模块目录，通过 `index.ts` 统一对外导出，原路径保留 re-export 兼容过渡 | 低 | - [x] 跑 `tests/attribute-view-search.test.ts`<br>- [x] 跑 `tests/attribute-view-candidate-policy.test.ts`<br>- [x] 跑全量搜索控制器测试 | `docs/project-structure.md`：调整属性视图模块目录树与职责说明 | done |
| RF-004 | P1 | 测试用例规范性与对象字面量语法告警修复 | `tests/store-context.test.ts`<br>`tests/canvas-replacement.test.ts`<br>`tests/canvas-search-decoration.test.ts` | 移除重复定义的字面量键名（`Duplicate key "occ"`），消除 esbuild 编译告警 | 极低 | - [x] 定向执行对应测试文件，确保 100% 通过且无 warning 输出 | 无 | done |
| RF-005 | P2 | 主入口生命周期与辅助函数解耦与整理 | `src/index.ts` | 梳理 `src/index.ts` 内联注册与辅助方法，清理多余冗余代码，提升可维护性 | 低 | - [x] 跑 `tests/plugin-settings-panel.test.ts`<br>- [x] 跑 `tests/plugin-settings-sync.test.ts`<br>- [x] 跑 `tests/topbar-icon.test.ts` | `docs/project-structure.md`：更新入口模块映射 | done |

优先级说明：
- `P0`：价值和风险都最高，优先执行（消除孤立代码隐患与状态缺陷）
- `P1`：价值或风险中等，放在 `P0` 之后（模块目录规整与消除告警）
- `P2`：低风险清理项，最后执行（主入口样板代码梳理）

状态说明：
- `pending`
- `in_progress`
- `done`
- `blocked`

## 4. 执行日志

| ID | 开始日期 | 结束日期 | 验证命令 | 结果 | 已刷新文档 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| RF-001 | 2026-10-23 | 2026-10-23 | `pnpm test` && `pnpm build` | pass | 待刷新 `docs/project-structure.md` | 成功删除 11 个孤立死代码文件，全量 79 个测试文件 431 个用例全过，打包构建校验正常 |
| RF-002 | 2026-10-23 | 2026-10-23 | `pnpm test tests/mobile-ui.test.ts tests/store-ui-state.test.ts` | pass | 待刷新 `docs/project-structure.md` | 导出统一的 `createInitialSearchReplaceState` 与 `resetSearchReplaceState`，修复测试中非法选项赋值，消除 Vue 运行时 prop 警告 |
| RF-003 | 2026-10-23 | 2026-10-23 | `pnpm test tests/attribute-view-search.test.ts tests/attribute-view-candidate-policy.test.ts` | pass | 待刷新 `docs/project-structure.md` | 抽取 `search-service.ts` 并在 `attribute-view/index.ts` 聚合，保持向后兼容过渡导出，全量测试通过 |
| RF-004 | 2026-10-23 | 2026-10-23 | `pnpm test` | pass | 无 | 修复 5 个测试文件中因复制粘贴导致的 `Duplicate key "occ"` 字面量键名，全套件 0 警告完全通过 |
| RF-005 | 2026-10-23 | 2026-10-23 | `pnpm test` && `pnpm build` | pass | 待刷新 `docs/project-structure.md` | 精简 `src/index.ts` 中无用 import 与冗余逻辑，测试与打包 100% 通过 |

## 5. 决策与确认

- 用户批准的条目：RF-001, RF-002, RF-003, RF-004, RF-005（全部批准）
- 延后的条目：无
- 阻塞条目及原因：无

## 6. 文档刷新

- `docs/project-structure.md`：已新建并完整反映项目最新模块划分、文件清单与职责映射（包含编辑器、属性视图、全库搜索等各层职责）。
- `README.md`：已补充全库搜索侧边栏能力说明及常用开发与构建命令。
- `AGENTS.md`：已补充项目核心概述与关键开发命令，并保留思源内核参考指引。
- 最终同步检查：已执行 `pnpm test` 与 `pnpm build`，79 个测试文件 432 个测试全部 PASS 且 0 警告，构建打包校验完全通过。

## 7. 下一步

1. 所有获批重构项（RF-001 至 RF-005）与文档刷新均已圆满完成。
2. 代码库结构清晰、无孤立死代码、测试 0 告警，可进入下一阶段业务迭代。
