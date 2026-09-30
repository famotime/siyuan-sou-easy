# SiYuan v3.8.5 开发进展与 API 迁移指南

- 适用版本：SiYuan `v3.8.5` / npm `siyuan@1.2.8`（含 `v1.2.9` 规划预演）
- 最后核对：2026-09-25
- 稳定性：版本迁移基线
- 本地源码基线：`d:\\MyCodingProjects\\siyuan-note`（Release `v3.8.5` / `master`）
- 官方类型基线：`d:\\MyCodingProjects\\siyuan-petal`（`v1.2.8` / HEAD）
- 官方示例基线：`d:\\MyCodingProjects\\siyuan-plugin-sample`（`v0.5.2`）
- 权威来源：
  - <https://github.com/siyuan-note/siyuan/releases/tag/v3.8.5>
  - <https://github.com/siyuan-note/siyuan/blob/master/docs/PLUGIN-PUBLISH.zh-CN.md>
  - <https://github.com/siyuan-note/siyuan/blob/master/docs/API.zh-CN.md>
  - <https://github.com/siyuan-note/petal>
  - <https://github.com/siyuan-note/plugin-sample>

---

## 1. 基线演化概览

从 `v3.8.3` 到 `v3.8.5`，思源笔记完成了一轮面向工业级稳定、类型安全与只读发布架构的重大演进：

1. **插件生态基线提升至 3.8.5**：
   - 官方示例 `plugin-sample` 将 `minAppVersion` 正式提升至 `3.8.5`，npm `siyuan` 正式发布至 `1.2.8`。
2. **内核 API 强类型契约系统全面落地（#19378）**：
   - `siyuan-petal` 彻底重构了 `types/api/index.d.ts`，导出基于内核源码契约直接生成的端到端强类型定义。`fetchPost`、`fetchSyncPost` 和 `fetchGet` 实现了对全部公开路由请求/响应的自动化精准推导，告别以往手写 `any` 或宽松类型时代。
3. **插件发布服务系统正式上线（#18354）**：
   - 针对思源官方文档发布服务（Publishing Service），正式建立基于快照的插件发布与安全隔离机制。插件需在 `plugin.json` 中显式声明 `publish.resources` 与 `publish.data`，并通过管理员单独授权方可在发布页面展示内容。
4. **只读模式与安全沙箱防护进一步收紧**：
   - 明确了只读/发布环境下前端插件的检测标准与行为底线：严禁执行写操作、严禁向内核发通信绑定、读取公开快照失败时严禁回退到私有存储（`loadData`）。
   - 内核插件私有服务（`IResponseFile`）全面强制限制在当前工作空间路径内，越界访问一律拦截为 404（GHSA-phmw-4rgv-r4xv）。
5. **官方统一单/多行输入对话框（`openInputDialog`）**：
   - 结束了各插件自己通过 `new Dialog()` 拼接 HTML 输入框的碎片化历史，官方提供支持验证、单多行切换、快捷动作按钮的统一 `openInputDialog` 组件。
6. **顶栏扩展与命令系统质感升级**：
   - 顶栏按钮 `addTopBar` 增强：支持挂载完全自定义 DOM 元素（`element`），支持专用右键上下文菜单（`contextMenu`）。
   - 命令配置 `ICommand` 增强：支持多快捷键列表（`hotkeys` 数组）、上下文可用性谓词（`when`）与启用谓词（`enabled`）。
7. **数据视图与块模型演进**：
   - 数据库（AV）新增**日历视图**（Calendar View #13740）与**列表视图**（List View #17743），表格单元格默认支持**富文本编辑**（#19188）。
   - 列表块支持**可编辑的思维导图视图**（#18831），新增思维导图节点快捷键；新增文档整树复制接口（`/api/filetree/duplicateDocTree`）与资源全量替换接口（`/api/asset/replaceAssetRef`）。

---

## 2. 内核 API 端到端强类型契约系统（#19378）

### 2.1 契约演进原理

在以往版本中，插件开发者调用 `fetchPost` / `fetchSyncPost` 时，通常需要手动指定泛型或接收 `IWebSocketData`，容易出现字段拼写错误或类型定义与真实内核不一致的问题。

从 `siyuan@1.2.8` 起，类型包直接包含由思源 Go 内核生成的全量路由契约映射表：

```typescript
// types/api/index.d.ts
export type FetchPost<Legacy = APILegacyResponse> = <Path extends string>(
  url: Path,
  ...args: Path extends keyof APIPOSTRoutes
    ? [...APIRequestArgs<APIPOSTRoutes[Path]>, ...APIPostTail<APIPOSTRoutes[Path]>]
    : Path extends APILegacyPOSTPath ? LegacyPostArgs<Legacy>
      : string extends Path ? LegacyPostArgs<Legacy> : never
) => Promise<void>;

export type FetchSyncPost<Legacy = APILegacyResponse> = <Path extends string>(
  url: Path,
  ...args: Path extends keyof APIPOSTRoutes
    ? [...APIRequestArgs<APIPOSTRoutes[Path]>, ...APISyncTail]
    : Path extends APILegacyPOSTPath ? [data?: any, ...tail: APISyncTail]
      : string extends Path ? [data?: any, ...tail: APISyncTail] : never
) => Promise<...>;
```

### 2.2 开发者收益与实践

现在，只要传入已知的接口路径，TypeScript 编辑器将自动推导首参 `data` 的结构以及返回值的具体字段：

```typescript
import { fetchSyncPost } from "siyuan"

// 自动推导出 data 必须包含 id: string，返回值中带有 kramdown 字段
const res = await fetchSyncPost("/api/block/getBlockKramdown", {
  id: "20260925150000-abcdefg",
})

if (res.code === 0) {
  // 类型安全：res.data.kramdown 会被智能补全
  console.log("Kramdown:", res.data.kramdown)
}
```

- **精确路径识别**：输入路径时支持编辑器自动补全全部官方路由（如 `/api/block/*`, `/api/filetree/*`, `/api/av/*` 等）。
- **特殊通道契约**：覆盖了流式传输（SSE）、代理（raw proxy）、二进制文件流等特殊模式。

---

## 3. 插件发布服务规范与只读模式（#18354）

### 3.1 核心设计架构

当思源笔记开启发布服务后，访客可以在浏览器中阅读公开的笔记本。发布页面的环境特点是：
1. **只读权限**：访客无权调用写接口，也没有思源管理员权限。
2. **私有存储隔离**：`data/storage/` 属于私有存储，不能直接暴露给发布访客，且直接读取会因无权限而失败。
3. **数据授权三步走**：
   - 步骤 1：管理员开启思源发布服务；
   - 步骤 2：在插件卡片开启该插件的「发布服务」开关；
   - 步骤 3：点击卡片上的「发布插件数据」图标按钮，审查插件声明的公开字段并授权。

### 3.2 plugin.json 声明规范

```json
{
  "name": "my-plugin",
  "minAppVersion": "3.8.5",
  "disabledInPublish": false,
  "publish": {
    "resources": [
      "views/public.html",
      "fonts/"
    ],
    "data": [
      "theme",
      "publicConfig"
    ]
  }
}
```

- **`publish.resources`**：声明发布端所需的前端静态资源相对路径。支持具体文件以及以 `/` 结尾的递归目录（如 `fonts/`）。严禁声明 `plugin.json`、`kernel.js`、软链接或含有 `..` 的越界路径。
- **`publish.data`**：声明公开的数据字段名称列表。**仅允许标量类型**（`string` | `number` | `boolean` | `null`），禁止声明复杂嵌套对象，以防未来增加属性时悄悄扩大公开范围。单快照总大小限制为 1 MiB。

### 3.3 插件类 API 与代码范式

```typescript
import { Plugin, showMessage } from "siyuan"

export default class MyPlugin extends Plugin {
  public isReadonly: boolean
  private publishDataStatus = ""

  async onload() {
    // 1. 检测只读或发布环境
    this.isReadonly = Boolean((window as any).siyuan?.config?.readonly || (window as any).siyuan?.isPublish)

    // 2. 区分环境加载数据
    if (this.isReadonly) {
      await this.loadPublishedSettings()
      // 只读发布环境下仅执行纯展示逻辑，提前返回，不注册写命令或内核 RPC
      return
    }

    // 3. 管理员环境正常加载私有数据
    const localData = await this.loadData("config.json").catch(() => null)
    // 绑定内核与写入事件...
  }

  /**
   * 读取公开数据快照（供发布端使用）
   */
  private async loadPublishedSettings() {
    this.data["config.json"] = { publicConfig: "默认值" }
    try {
      const snapshot = await this.loadPublishData()
      if (typeof snapshot?.publicConfig === "string") {
        this.data["config.json"].publicConfig = snapshot.publicConfig
      }
    } catch (err: any) {
      const code = err?.code
      this.publishDataStatus =
        code === 403 ? "公开数据未获管理员授权"
        : code === 404 ? "公开数据快照尚未生成"
        : "读取公开数据失败"
      // 绝对不能回退读取 loadData("config.json")！
    }
  }

  /**
   * 管理员端保存公开数据快照
   */
  public async publishSettings(text: string) {
    if (this.isReadonly) return
    try {
      // 必须完整替换快照对象，且仅包含声明的标量字段
      await this.savePublishData({ publicConfig: text })
      showMessage("公开快照已更新")
    } catch (err: any) {
      const code = err?.code
      showMessage(code === 403 ? "发布失败：需要管理员在插件卡片单独授权" : "保存失败")
    }
  }

  onunload() {
    if (this.isReadonly) return
    // 正常清理...
  }

  async uninstall() {
    if (this.isReadonly) return
    // 正常清理...
  }
}
```

---

## 4. 插件前端新 API 详析

### 4.1 统一单/多行输入对话框 (`openInputDialog`)

在 v3.8.4+，思源官方在 SDK 中导出了标准化的输入弹窗组件：

```typescript
import { openInputDialog } from "siyuan"

openInputDialog({
  title: "快速修改名称",
  value: "原名称",
  label: "新名称",
  placeholder: "请输入新名称...",
  multiline: false, // 设为 true 时渲染为 textarea
  maxLength: 100,
  width: "520px",
  description: "基于官方 openInputDialog 统一组件实现",
  actions: [
    {
      text: "重置默认",
      position: "beforeConfirm",
      onClick: (val, dialog) => {
        // 自定义额外操作
      },
    },
  ],
  onConfirm: (val, dialog) => {
    console.log("用户提交的值:", val)
    // 校验成功后由插件自行关闭弹窗
    dialog.destroy()
  },
})
```

### 4.2 顶栏按钮右键上下文菜单 (`addTopBar.contextMenu`)

以往顶栏按钮若需右键菜单，开发者往往需要自己给返回的 DOM 元素绑定 `contextmenu` 事件，并手动计算位置与管理样式。

现在 `addTopBar` 内置了 `contextMenu` 配置项，与思源原生的顶栏显隐控制菜单完美融合：

```typescript
this.addTopBar({
  id: "my-plugin-topbar",
  icon: "iconSamplePlugin",
  title: "我的插件",
  contextMenu: (menu) => {
    if (this.isReadonly || this.isMobile) return

    // 同步添加菜单项，宿主会自动在插件菜单与内置显隐菜单之间添加分隔线并去重
    menu.addItem({
      id: "my-plugin-topbar-settings",
      icon: "iconSettings",
      label: "插件设置",
      click: () => this.openSetting(),
    })
  },
  callback: () => {
    this.openSetting()
  },
})
```

- **支持挂载自定义 DOM 元素**：`addTopBar` 新增了 `element?: HTMLElement` 选项。如果传入 `element`，则 `icon` 与 `callback` 会被忽略，思源会保留插件元素的内部结构与事件，并将其纳入顶栏排序与显隐管理体系。

### 4.3 命令系统多快捷键与条件控制 (`ICommand`)

`ICommand` 接口在 v3.8.4/v3.8.5 中进行了重要扩充：

```typescript
this.addCommand({
  langKey: "myAction",
  // 原有单一 hotkey 继续保留兼容
  hotkey: "⌥⇧M",
  // 新增：支持多组备选默认快捷键列表（优先于 hotkey）
  hotkeys: ["⌥⇧M", "Alt+Shift+M"],
  // 新增：可用性谓词（当返回 false 时，命令不会出现在命令面板中，也不会响应快捷键）
  when: (context) => !this.isReadonly && Boolean(context.protyle),
  // 新增：启用状态谓词
  enabled: (context) => true,
  // 新增：异步执行方法
  execute: async (context) => {
    await this.doSomething(context)
  },
})
```

### 4.4 闪卡 V2 复习会话与查询 AST

`openTab` 的 `card` 选项升级为 V2 会话模型：

```typescript
openTab({
  app: this.app,
  card: {
    type: "all",
    // 多个卡包取并集去重
    reviewSetIDs: ["deck-id-1", "deck-id-2"],
    // 指定有序卡片列表
    cardIDs: ["card-id-1", "card-id-2"],
    // 版本 1 查询 AST，与卡包范围取交集
    query: {
      version: 1,
      root: {
        operator: "predicate",
        field: "rootID",
        comparator: "in",
        value: ["doc-id-1"],
      },
    },
    reviewMode: "normal", // 或 "reinforcement"
  },
})
```

---

## 5. 数据视图与块模型演进

### 5.1 数据库（Attribute View）新特性
- **日历视图（Calendar View）**：AV 视图类型新增支持日历展示模式，配置键为 `calendar`。
- **列表视图（List View）**：AV 视图类型新增支持紧凑列表展示模式，配置键为 `list`。
- **表格单元格富文本**：表格单元格全面支持 Kramdown 富文本排版与行内语法解析，在导出与预览中均保持格式一致。
- **行数限制（Row Limit）**：SQL 查询与视图渲染支持明确的分页与截断指示。

### 5.2 块模型与思维导图
- **列表块思维导图（List Mind Map #18831）**：列表块原生支持切换至思维导图模式进行可视化查看与编辑。
- **自定义块搜索（#19508）**：自定义块（`NodeCustomBlock`，即 `;;;包名/类型` 块）的内容现已正式纳入思源 FTS 全文搜索索引。

### 5.3 新增公开内核 API

| 接口路径 | 请求方法 | 权限要求 | 描述 |
| :--- | :--- | :--- | :--- |
| `/api/filetree/duplicateDocTree` | POST | 读写 | 连同整棵子文档树一起完整复制文档 |
| `/api/asset/replaceAssetRef` | POST | 读写 | 全量替换工作空间中对特定静态资源文件的所有引用路径 |
| `/api/petal/getPluginPublishInfo` | POST | 管理员 | 获取插件在发布服务中的声明资源、公开字段及当前授权状态 |
| `/api/petal/setPluginPublishDataGrant` | POST | 管理员 | 授予或撤销插件公开字段的发布数据授权 |
| `/api/petal/savePluginPublishData` | POST | 管理员 | 保存/全量替换插件的公开数据快照 |
| `/api/petal/loadPluginPublishData` | POST | 访客/公开 | 读取已获授权且已生成的插件公开数据快照 |

---

## 6. 安全加固与开发边界规范

1. **GHSA-phmw-4rgv-r4xv：内核插件私有服务文件越界防护**：
   - 内核插件通过 `this.siyuan.server.private.http.handler` 返回本地文件（`body: { file: { path: "..." } }`）时，文件路径必须严格限定在当前思源工作空间内（例如 `/data/plugins/<name>/...`）。任何通过符号链接、目录联接或绝对路径试图访问工作空间以外文件的行为均会被内核直接以 404 拒绝。
2. **GHSA-2w6q-wgc8-q743：跨站请求伪造与网络代理防护**：
   - 思源内核拒绝未经授权的外部跨站浏览器请求，保护敏感文件读写接口安全。
3. **插件公开数据存储物理隔离**：
   - 授权记录与公开数据快照独立保存在 `conf/plugin-publish/<name>.json` 中，绝对不混入工作空间私有数据目录，也不随常规同步自动分发至其他未授权设备。

---

## 7. 迁移自查清单（Checklist）

- [x] **基线依赖升级**：
  - `package.json` 中的 `siyuan` 依赖提升至 `^1.2.8`；
  - `plugin.json` 中的 `minAppVersion` 提升至 `3.8.5`。
- [x] **发布服务适配**：
  - 在 `plugin.json` 中配置 `"disabledInPublish": false` 及规范的 `"publish"` 块；
  - 检查公开字段是否均为标量类型（字符串/数值/布尔）；
  - 在代码中引入 `this.isReadonly` 检测，只读模式下阻断写操作并使用 `loadPublishData()`。
- [x] **交互组件现代化**：
  - 将临时的设置/单行输入弹窗迁移至 `openInputDialog`；
  - 顶栏按钮如果包含菜单，推荐使用 `addTopBar.contextMenu` 代替自行监听原生右键事件。
- [x] **命令快捷键优化**：
  - 为高频命令补充 `hotkeys` 备选列表，并配置 `when` 谓词以避免只读环境下误触发。
- [x] **内核插件安全检查**：
  - 检查 `kernel.ts` 私有服务响应，确保所有文件服务路径严格位于工作空间之内。
