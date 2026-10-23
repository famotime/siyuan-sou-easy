# 项目结构与架构说明 (Project Structure)

本文档记录 `siyuan-sou-easy` 插件的代码组织、核心模块划分与职责映射，供开发者与维护 Agent 查阅。

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
│   ├── components/                   # 公共 UI 组件
│   │   └── SiyuanTheme/              # 思源风格基础控件 (SyButton, SyInput, SyCheckbox, etc.)
│   ├── features/search-replace/      # 核心业务功能目录
│   │   ├── types.ts                  # 基础搜索类型与接口
│   │   ├── search-engine.ts          # 正则、全字、大小写文本匹配核心引擎
│   │   ├── kernel.ts                 # 思源内核 API 通信封装 (SQL, DOM, Keymap 等)
│   │   ├── debug.ts                  # 调试日志与节点检查
│   │   ├── match-utils.ts            # 匹配结果工具函数
│   │   ├── preserve-case.ts          # 保留大小写样式替换算法
│   │   ├── native-navigation.ts      # 原生光标与块定位辅助
│   │   ├── settings-panel.ts         # 设置面板类型与元数据
│   │   ├── plugin-*-config.ts        # 命令与快捷键注册辅助
│   │   ├── plugin-*-ui.ts            # 设置面板 DOM 构建与绑定
│   │   ├── editor/                   # Protyle 编辑器 DOM 访问与装饰层
│   │   │   ├── index.ts / context.ts # 编辑器上下文获取与缓存匹配
│   │   │   ├── blocks.ts             # 块元素收集与文本解析 (支持表格、多容器)
│   │   │   ├── decorations.ts        # 高亮标记渲染、动画与视口同步
│   │   │   ├── replacement.ts        # DOM 文本节点就地替换与克隆计算
│   │   │   ├── selection.ts          # 选区范围识别与选区内模式 (selectionOnly)
│   │   │   ├── table-dom.ts          # 表格单元格精确定位与文本操作
│   │   │   └── attribute-view.ts     # 编辑器内属性视图单元格 DOM 定位
│   │   ├── store/                    # 文档内搜索状态管理
│   │   │   ├── state.ts              # 响应式状态树定义与重置函数
│   │   │   ├── search-controller.ts  # 搜索防抖调度、当前匹配导航控制
│   │   │   ├── replacement.ts        # 单个/批量替换业务编排与内核同步
│   │   │   ├── context-cache.ts      # 编辑器上下文与选区缓存
│   │   │   ├── ui-state.ts           # 面板位置、尺寸记忆与持久化
│   │   │   └── search-pending-navigation.ts # 异步跳转重试与高亮同步
│   │   ├── attribute-view/           # 数据库属性视图 (Attribute View) 搜索
│   │   │   ├── index.ts              # 统一导出入口
│   │   │   ├── search-service.ts     # 属性视图搜索业务编排
│   │   │   ├── search-blocks.ts      # 属性视图块收集与元数据解析
│   │   │   ├── search-candidates.ts  # 候选单元格数据采集
│   │   │   ├── search-dom-candidates.ts # 视口内 DOM 单元格快速采集
│   │   │   └── search-types.ts       # 属性视图专用类型定义
│   │   ├── canvas/                   # 白板导图 (Canvas) 搜索与替换
│   │   │   ├── context.ts            # 白板宿主检测与上下文
│   │   │   ├── search-blocks.ts      # 白板文字节点收集
│   │   │   ├── decorations.ts        # 白板高亮渲染桥接
│   │   │   └── replacement.ts        # 白板文字就地替换
│   │   ├── terminal/                 # 终端页面搜索适配
│   │   ├── ui/                       # 文档内搜索界面子组件
│   │   │   ├── SearchToolbarRow.vue  # 搜索工具栏与开关按钮
│   │   │   ├── ReplaceActionRow.vue  # 替换输入框与操作按钮
│   │   │   ├── RegexHelpPanel.vue    # 正则语法速查弹窗
│   │   │   └── use-panel-minimap.ts  # 迷你地图联动 Hook
│   │   └── global/                   # 全库搜索与替换 (Dock 侧边栏)
│   │       ├── store.ts              # 全库搜索响应式状态
│   │       ├── dock-manager.ts       # 思源 Dock 挂载与焦点管理
│   │       ├── history-tab-manager.ts# 替换历史独立 Tab 挂载
│   │       ├── doc-aggregator.ts     # 全库搜索结果按文档聚合与排序
│   │       ├── replace-engine.ts     # 全库批量替换引擎与事务生成
│   │       ├── diff-builder.ts       # 替换差异文本生成 (Diff 计算)
│   │       ├── transaction-history.ts# 替换事务历史记录与回退管理
│   │       ├── kernel-query.ts       # 基于 SQL / API 的批量内容检索
│   │       ├── query-parser.ts       # 高级查询解析器 (多关键词、过滤词)
│   │       ├── pinyin-match.ts       # 拼音模糊匹配
│   │       ├── pinyin/               # 拼音词典与拼音检索引擎
│   │       └── ui/                   # 全库搜索 UI 组件
│   │           ├── GlobalSearchDockView.vue # 全库搜索主视图
│   │           ├── DocAggregateItem.vue     # 单文档匹配折叠项
│   │           ├── FilterPillsBar.vue       # 过滤标签栏
│   │           ├── VisualDiffModal.vue      # 替换前后对比浮层
│   │           └── TransactionHistoryDrawer.vue # 历史记录抽屉
│   ├── i18n/                         # 国际化语言包 (zh_CN.json, en_US.json)
│   └── types/                        # 全局 TypeScript 类型声明
├── tests/                            # 自动化测试套件 (430+ Vitest 用例)
├── docs/                             # 规范文档与方案设计
│   ├── refactor-plan.md              # 代码重构跟踪与验证计划
│   ├── project-structure.md          # 模块架构与文件职责映射 (本文档)
│   └── siyuan-search-analysis-and-sou-easy-evolution.md # 架构演进分析
├── scripts/                          # 发版与包校验脚本
└── package.json                      # 依赖与脚本配置
```

## 2. 核心模块与职责分工

### 2.1 插件生命周期与宿主集成 (`src/index.ts`)
- **生命周期管控**：管理 `onload`、`onunload`、`uninstall`。
- **UI 挂载**：初始化顶部栏图标、全库搜索侧边栏 Dock、替换历史 Tab 以及文档内浮动替换面板。
- **快捷键系统**：监听全局键盘事件，联动思源内置 `keymap` 完成冲突检测与动态热键更新。

### 2.2 文档内搜索与替换 (`src/features/search-replace/`)
- **状态流转**：通过 `store/state.ts`、`store/search-controller.ts` 实现防抖搜索、当前匹配光标滚动和跨块导航。
- **DOM 操作与安全替换**：`editor/` 模块专门负责针对 Protyle WYSIWYG 树的精确定位，保证在不破坏思源块属性（`data-node-id`）的前提下完成安全的文本替换。
- **多容器适配**：统一支持常规段落、代码块、数学公式块、表格单元格（`table-dom.ts`）、属性视图（`attribute-view/`）与导图白板（`canvas/`）。

### 2.3 全库搜索与批量替换 (`src/features/search-replace/global/`)
- **多维度检索**：支持普通文本、正则表达式、拼音首字母/全拼检索以及多词逻辑组合。
- **安全替换事务机制**：批量替换前通过 `diff-builder.ts` 生成变更预览，替换过程记录在 `transaction-history.ts` 中，防止误操作。

## 3. 质量保障与维护规范

- **自动化测试**：所有修改优先通过 `pnpm test` 验证，核心逻辑覆盖率 100%。
- **构建与集市规范**：通过 `pnpm build` 进行产物打包，并执行 `verify-package.mjs` 校验 zip 格式与隐藏文件过滤。
