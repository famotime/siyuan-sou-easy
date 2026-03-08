# 项目结构

## 1. 顶层目录

- `src/`：插件源码
- `tests/`：Vitest 自动化测试与 SiYuan mock
- `docs/`：产品、开发、重构与结构文档
- `scripts/`：发布前检查等脚本
- `asset/`、`icon.png`、`preview.png`：静态资源
- `dist/`、`package.zip`：构建产物

## 2. 运行入口

| 文件 | 职责 |
| --- | --- |
| `src/index.ts` | SiYuan 插件入口；负责生命周期、命令、顶栏入口、设置面板与事件总线绑定 |
| `src/main.ts` | 挂载与销毁 Vue 根实例，连接插件实例与搜索替换 store |
| `src/App.vue` | 搜索替换面板 UI、拖拽与焦点交互 |
| `src/plugin-commands.ts` | 入口命令注册、命令热键同步、编辑器事件绑定/解绑 |
| `src/plugin-settings.ts` | 设置面板项构建、热键输入控件、热键冲突来源收集 |

## 3. 搜索替换核心模块

### 3.1 Store 编排层

| 文件 | 职责 |
| --- | --- |
| `src/features/search-replace/store.ts` | 对外 store API；编排面板开关、匹配刷新、替换动作、observer 与持久化调度 |
| `src/features/search-replace/store-state.ts` | `searchReplaceState` 响应式状态、面板位置类型与归一化 |
| `src/features/search-replace/store-context.ts` | 编辑器上下文缓存、hint 回退、实时刷新的目标解析 |
| `src/features/search-replace/store-ui-state.ts` | 面板位置的读取与保存 |
| `src/features/search-replace/store-replace.ts` | 按块分组准备替换结果，并执行 DOM block 更新 |

### 3.2 Editor DOM 边界层

| 文件 | 职责 |
| --- | --- |
| `src/features/search-replace/editor.ts` | 对外 editor API 聚合导出 |
| `src/features/search-replace/editor-context.ts` | 当前编辑器识别、可见编辑器收集、rootId/title 解析 |
| `src/features/search-replace/editor-blocks.ts` | 搜索块采集、块定位、纯文本提取、预览文本构建 |
| `src/features/search-replace/editor-decorations.ts` | 搜索结果高亮、当前命中高亮、滚动定位 |
| `src/features/search-replace/editor-replace.ts` | 单块文本范围替换与可替换性判定 |
| `src/features/search-replace/editor-constants.ts` | editor 子模块共享常量 |

### 3.3 纯逻辑与边界适配

| 文件 | 职责 |
| --- | --- |
| `src/features/search-replace/search-engine.ts` | 关键字/正则匹配、整词判断、命中结果生成 |
| `src/features/search-replace/preserve-case.ts` | 按命中内容大小写调整替换文本 |
| `src/features/search-replace/kernel.ts` | 调用 SiYuan kernel API 更新 block DOM |
| `src/features/search-replace/debug.ts` | 调试日志开关与输出 |
| `src/features/search-replace/types.ts` | 搜索、替换、编辑器上下文相关类型 |

## 4. 共享模块

| 文件/目录 | 职责 |
| --- | --- |
| `src/settings.ts` | 插件设置定义、归一化、搜索选项派生 |
| `src/hotkeys.ts` | 快捷键格式化、归一化、冲突检测 |
| `src/components/SiyuanTheme/` | 主题化基础组件 |
| `src/i18n/` | 多语言文案 |
| `src/icons.ts` | 插件图标与顶栏入口资源 |

## 5. 测试映射

| 测试文件 | 覆盖重点 |
| --- | --- |
| `tests/store-context.test.ts` | store 的编辑器上下文回退 |
| `tests/live-refresh.test.ts` | 当前文档 DOM 变化后的实时刷新 |
| `tests/store-actions.test.ts` | 替换分组、busy 保护、选区预载、关闭清理 |
| `tests/store-ui-state.test.ts` | 面板位置加载、保存与 remember 开关 |
| `tests/editor-context-detection.test.ts` | 活动编辑器识别 |
| `tests/editor-block-collection.test.ts` | 块去重、code block 开关、元数据过滤 |
| `tests/plugin-settings-sync.test.ts` | 设置保存后的命令热键同步与提示行为 |
| `tests/current-block-highlight.test.ts` | 当前命中块高亮 |
| `tests/replacement-offset.test.ts` | 文本范围替换与跨节点不可替换场景 |
| `tests/search-engine.test.ts` | 搜索算法 |
| `tests/preserve-case.test.ts` | 大小写保持逻辑 |

## 6. 当前结构特征

- `store.ts` 与 `editor.ts` 保留稳定对外 API，内部职责拆到 `store-*` 与 `editor-*` 子模块
- `index.ts` 保留插件类与生命周期编排，命令/事件和设置面板逻辑下沉到 `plugin-commands.ts`、`plugin-settings.ts`
- 搜索算法、替换大小写与设置/快捷键逻辑仍保持独立纯逻辑模块，便于单测
- UI 层仍集中在 `src/App.vue`，后续若继续重构，可继续拆拖拽、焦点与输入守卫逻辑
