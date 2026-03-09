# 项目结构

## 1. 顶层目录

| 路径 | 作用 |
| --- | --- |
| `src/` | 插件源码、Vue 面板、搜索替换核心逻辑 |
| `tests/` | Vitest 自动化测试与 SiYuan mock |
| `docs/` | 产品、开发、验证与重构文档 |
| `scripts/` | 发布前检查脚本 |
| `asset/`、`icon.png`、`preview.png` | 插件静态资源与展示素材 |
| `plugin.json`、`package.json` | 插件元数据、脚本与依赖 |

## 2. `src/` 模块划分

### 2.1 入口与挂载

| 文件 | 职责 |
| --- | --- |
| `src/index.ts` | 插件生命周期、顶栏入口、命令注册、设置面板装配 |
| `src/main.ts` | 绑定插件实例、初始化 store、挂载/卸载 Vue 面板 |
| `src/App.vue` | 搜索面板模板层，组合 store 与 UI composable |
| `src/index.scss` | 插件面板、命中高亮和 minimap 样式 |

### 2.2 搜索替换核心

| 路径 | 职责 |
| --- | --- |
| `src/features/search-replace/types.ts` | 核心领域类型：上下文、块、命中、选区范围 |
| `src/features/search-replace/search-engine.ts` | 纯搜索逻辑：普通文本、大小写、全词、正则、选区过滤 |
| `src/features/search-replace/kernel.ts` | SiYuan 内核 API 封装，当前主要负责 `updateBlock` |
| `src/features/search-replace/preserve-case.ts` | 替换文本大小写保持逻辑 |
| `src/features/search-replace/debug.ts` | 可开关的调试日志输出 |

### 2.3 插件入口辅助层

| 路径 | 职责 |
| --- | --- |
| `src/features/search-replace/plugin-events.ts` | 编辑器上下文相关事件清单与注册/解绑辅助 |
| `src/features/search-replace/settings-panel.ts` | 设置面板声明式配置，集中维护 hotkey/boolean 设置项顺序 |

### 2.4 Store 编排层

| 路径 | 职责 |
| --- | --- |
| `src/features/search-replace/store.ts` | 对外公开 store API，协调状态刷新、事件响应和替换流程 |
| `src/features/search-replace/store/state.ts` | 响应式 UI 状态与持久化位置类型 |
| `src/features/search-replace/store/context-cache.ts` | 编辑器上下文与选区范围缓存、回连与回退策略 |
| `src/features/search-replace/store/ui-state.ts` | 面板位置持久化读写与归一化 |
| `src/features/search-replace/store/replacement.ts` | 替换当前/全部替换执行流程 |

### 2.5 编辑器 DOM 适配层

| 路径 | 职责 |
| --- | --- |
| `src/features/search-replace/editor.ts` | 对外兼容导出入口 |
| `src/features/search-replace/editor/context.ts` | 当前编辑器、当前文档与可见 protyle 检测 |
| `src/features/search-replace/editor/blocks.ts` | 可搜索块采集、块 DOM 查询、块文本提取 |
| `src/features/search-replace/editor/selection.ts` | 原生选区转块内偏移范围 |
| `src/features/search-replace/editor/ranges.ts` | 文本偏移到 DOM Range / Text 节点位置的映射 |
| `src/features/search-replace/editor/decorations.ts` | 命中预览、高亮同步、滚动定位 |
| `src/features/search-replace/editor/replacement.ts` | DOM 克隆替换与 replaceable 判定 |
| `src/features/search-replace/editor/constants.ts` | 高亮类名与支持块类型常量 |

### 2.6 UI composable 与基础组件

| 路径 | 职责 |
| --- | --- |
| `src/features/search-replace/ui/use-composed-input.ts` | IME 组合输入处理 |
| `src/features/search-replace/ui/use-panel-frame.ts` | 面板拖拽、缩放、viewport 约束 |
| `src/features/search-replace/ui/use-panel-minimap.ts` | minimap 布局、滚动投影、点击跳转、清理 |
| `src/features/search-replace/ui/regex-help.ts` | 正则帮助文案与示例 |
| `src/components/SiyuanTheme/` | 复用的 SiYuan 风格基础组件 |

### 2.7 其它共享模块

| 路径 | 职责 |
| --- | --- |
| `src/settings.ts` | 插件设置归一化、读写和搜索默认选项转换 |
| `src/hotkeys.ts` | 快捷键格式化、归一化、冲突检测、keymap 展平 |
| `src/icons.ts` | 顶栏图标定义 |
| `src/i18n/` | 中英文文案 |
| `src/types/` | 类型声明补充 |

## 3. 运行时链路

1. `src/index.ts` 在 `onload()` 中加载设置、初始化 UI、注册命令和编辑器事件。
2. `src/main.ts` 绑定插件实例并挂载 `src/App.vue`。
3. `src/App.vue` 通过 `store.ts` 读取状态、触发搜索/替换动作，并通过 UI composable 处理拖拽、IME 和 minimap。
4. `store.ts` 调用 `search-engine.ts` 计算命中，调用 `editor/*` 做 DOM 适配和高亮，调用 `kernel.ts` 执行写回。

## 4. 测试分层

| 测试类别 | 代表文件 | 覆盖重点 |
| --- | --- | --- |
| 入口与设置 | `tests/plugin-editor-events.test.ts`、`tests/plugin-settings-panel.test.ts`、`tests/hotkey-setting-input.test.ts` | 生命周期、设置面板、事件绑定、快捷键输入 |
| Store 编排 | `tests/store-context.test.ts`、`tests/live-refresh.test.ts`、`tests/store-replace-all.test.ts`、`tests/store-ui-state.test.ts` | 上下文回退、live refresh、替换执行、UI 状态持久化 |
| 编辑器 DOM 适配 | `tests/editor-context-detection.test.ts`、`tests/editor-block-collection.test.ts`、`tests/selection-scope.test.ts`、`tests/replacement-offset.test.ts` | 文档检测、块采集、选区映射、替换偏移 |
| UI 交互 | `tests/panel-widget.test.ts`、`tests/minimap-widget.test.ts`、`tests/selection-mode-panel.test.ts`、`tests/ime-search-input.test.ts` | 面板交互、viewport 约束、minimap、IME |

## 5. 维护约定

1. 对外 API 入口保持在 `src/features/search-replace/store.ts` 与 `src/features/search-replace/editor.ts`，内部实现优先放入子模块。
2. 新增设置项时，同时更新 `src/features/search-replace/settings-panel.ts`、`src/settings.ts` 和 `src/i18n/*.json`。
3. 涉及搜索范围、块采集、替换映射或 minimap 行为的变更，优先补对应的定向测试，再做实现。
