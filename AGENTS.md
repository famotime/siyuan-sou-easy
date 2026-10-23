
## Project Overview & Commands

- **项目目标**：思源笔记 VS Code 风格的文档内与全库搜索替换插件。
- **模块架构**：详见 [docs/project-structure.md](file:///d:/MyCodingProjects/siyuan-sou-easy/docs/project-structure.md)。
- **常用开发命令**：
  - 测试：`pnpm test`（Vitest 单元与集成测试）
  - 构建打包：`pnpm build`（Vite 生产构建并执行包校验）
  - 监听开发：`pnpm dev`

## Reference Projects

重要：在涉及解析思源笔记文档块结构和内容、确认API时，务必查看developer_docs目录下开发者文档 和 siyuan-note 项目源码确认，不要凭猜测开发和测试。

路径按开发机器取用其一（两套路径指向同一批参考工程，不同机器布局不同）：

- siyuan-note（思源笔记源码项目）
  - Windows 开发机：`D:\MyCodingProjects\siyuan-note`
  - Linux 开发机：`/home/quincyzou/projects/siyuan-note`
- `developer_docs/`：思源笔记插件开发者文档
  - 仓库根目录，并已列入 `.gitignore`（仅本机参考，不入库、不推送）。
- 核对内核行为时以 siyuan-note 的 Go 源码为准（`kernel/server/serve.go`、`kernel/model/assets.go`），`app/src` 为前端实现参考；developer_docs 未覆盖的细节不要凭猜测推断。
