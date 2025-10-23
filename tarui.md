# Tauri 改造设计说明

## 改造目标
- 以 Tauri 构建跨平台桌面端（Windows/macOS）客户端，改造现有 `frontend`（Web UI）与 `backend`（Python 服务）的核心能力。
- 支持多家大模型服务：豆包（现有）、ChatGPT、Gemini、Grok，桌面端新增API 管理页面，提供统一的 API 管理与切换体验。
- 引入多会话管理，每个会话绑定单一模型，支持历史记录与持久化。
- 所有 API Key 与对话内容在本地安全存储，保证离线可用与数据安全。

## 总体架构
```
app/
 ├─ packages/
 │   ├─ web/              ← 基于现有 frontend，作为 Tauri Webview 资源
 │   └─ backend-runner/   ← 负责打包/调用现有 Python backend
 ├─ src-tauri/            ← Tauri Rust 层，封装原生能力与进程管理
 └─ shared/               ← 公共 TypeScript 定义（API 封装、模型协议等）

Existing backend (Python FastAPI 等)
```
- **前端层（Webview）**：沿用 `frontend`，调整构建产物输出到 `app/packages/web/dist`，提供桌面端 UI。
- **原生壳（Rust/Tauri）**：负责窗口管理、系统托盘、应用升级、调用原生 API（文件、剪贴板、通知），并通过命令与 plugin 向 Webview 暴露安全接口。
- **后台服务集成**：
  - 维持 Python `backend` 作为知识库检索与索引服务，通过 Tauri 启动/停止子进程，或在开发模式下外部启动。
  - 在 Tauri Rust 层提供 HTTP 代理/桥接，统一前端调用路径。
- **多模型调度**：在前端引入统一的 LLM Provider SDK，由 Rust 层负责本地存储与加密，避免 API Key 泄露。

## 目录规划（新增 `app/`）
- `app/package.json`：Tauri Workspace 管理脚本（`tauri dev`, `tauri build`）。
- `app/src-tauri/`：
  - `Cargo.toml`：Rust crate 定义，依赖 `tauri`, `tauri-plugin-store`, `tauri-plugin-http`, `serde` 等。
  - `tauri.conf.json`：多平台打包配置（bundle identifier、icons、updater）。
  - `src/main.rs`：主入口，初始化窗口、插件、命令注册。
  - `src/backend.rs`：管理 Python backend 子进程（启动、健康检查、退出）。
  - `src/kv.rs`：封装本地存储与加密逻辑。
- `app/packages/web/`：迁移/复用 `frontend`，调整 Vite 构建输出目录及 Tauri 资源路径。
- `app/packages/backend-runner/`：可选，提供 Node/Rust 脚本帮助下载依赖、创建虚拟环境、调用 Python 服务。
- `app/shared/`：公共类型定义（LLM Provider、会话模型、API 响应协议）。

## 多模型与 API 管理
- **Provider 抽象**：定义统一的 `LLMProvider` 接口（`sendMessage`, `stream`, `listModels` 等）。
- **支持的提供商**：
  1. Doubao（沿用现有实现，迁移到 Provider 层）。
  2. ChatGPT（OpenAI API / 新接口）。
  3. Gemini（Google Generative AI）。
  4. Grok（xAI API）。
- **API 管理页面**：
  - 新增路由 `/settings/apis`，支持添加/编辑/删除 Provider Key。
  - 提供测试按钮验证 Key 可用性。
  - 支持设置默认 Provider，并查看限速/配额信息（若 API 支持）。
- **会话策略**：
  - 每个会话绑定单一 Provider + 模型，不允许在会话内切换。
  - 支持复制会话并切换模型生成新会话。
  - 历史会话记录支持搜索、时间排序、按 Provider 过滤。

## 本地数据存储
- **API Key**：使用 `tauri-plugin-store` + 操作系统安全存储（如 `tauri-plugin-secure-storage` 或 Windows DPAPI/macOS Keychain）进行加密存储。
- **会话与消息**：选择 SQLite（通过 `tauri-plugin-sql`）或本地 JSON（二者择其一，倾向 SQLite 方便查询与过滤）。
- **知识库缓存**：后端检索缓存放置在应用数据目录（`AppData/Roaming/KnowledgeQA/` 或 `~/Library/Application Support/KnowledgeQA/`）。
- **同步策略**：预留数据导出/导入接口，便于备份。

## 构建与打包
- 使用 `pnpm`/`npm` 脚本统一前端与 Tauri 构建流程：`pnpm tauri dev`、`pnpm tauri build`.
- `tauri.conf.json` 中配置：
  - `bundle.windows`：签名、图标、依赖 VC++ Runtime。
  - `bundle.macos`：应用标识符、签名与 Notarization（通过 CI 可选实现）。
  - 自定义协议（`knowledgeqa://`）用于调用/唤醒。
- 集成 CI/CD（GitHub Actions）：
  - `tauri-action` 用于自动打包 Windows `.msi`/`.exe` 与 macOS `.dmg`.
  - 上传产物到 Release，结合版本号。

## 与现有后端的协同
- 新增 Tauri 命令 `start_backend`/`stop_backend`，自动创建 Python 虚拟环境，安装依赖（可缓存）。
- 在开发模式下允许注入环境变量，指向外部运行的 backend。
- 定义前端访问路径：`/api/*` 由 Tauri 内置代理转发至本地 backend，以保持与 Web 部署一致的 API 路径。
- 若后端需要额外能力（如文件索引、embedding 任务），可通过 Rust 层调度异步任务并通知前端。

## 渐进式迁移建议
1. **初始化 Tauri 项目**：创建 `app/`，引入 `tauri init --template vanilla` 后手动对齐目录规划。
2. **迁移前端**：将 `frontend` 构建逻辑迁入 `app/packages/web`，调整 TS 配置及 API 调用至 Tauri 通道。
3. **桥接后端**：实现 Rust 子进程管理与健康检查，确保知识库功能可用。
4. **实现多模型 Provider 层**：抽象统一客户端，新增设置页面与本地存储。
5. **会话管理与持久化**：设计数据库 schema，完成 CRUD 与 UI 展示。
6. **打包与测试**：完成 Windows/macOS 打包流水线与 QA。

## 后续工作清单
- [ ] 初始化 `app/` 目录与 Tauri 配置。
- [ ] 前端资源打包与 API 调整。
- [ ] Rust 层插件与命令实现。
- [ ] 多模型 API 接入与验证。
- [ ] 本地存储实现（Key 与会话数据）。
- [ ] 桌面端交互优化（托盘、快捷键、通知等）。
- [ ] CI/CD 自动化打包。