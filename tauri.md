# Tauri 改造设计说明

## 改造目标
- 使用 Tauri 构建跨平台桌面客户端（Windows / macOS），承载现有 `frontend` Web UI 与 `backend` 知识库服务的核心能力。
- 统一大模型接入体验，支持豆包（现有）、ChatGPT、Gemini、Grok 等多家 Provider，并在桌面端提供 API Key 管理与模型切换。
- 引入多会话管理，每个会话绑定单一模型，支持会话历史持久化与同步。
- 将 API Key、会话内容及本地知识库数据安全保存在终端，确保隐私和离线可用性。

## 总体架构
```
app/
 ├─ src/           ← 迁移后的前端 Webview 资源
 ├─ src-tauri/     ← Rust / Tauri 原生层，实现知识库与系统能力
 └─ shared/        ← 计划中的前后端共享 TypeScript 定义
```
- **前端 Webview**：沿用原 `frontend` 界面，通过 `@tauri-apps/api` 与 Rust 命令交互。构建产物输出到 `app/dist`，供 `tauri build` 打包。
- **原生壳 (Rust)**：
  - 负责窗口、托盘、通知等原生能力封装。
  - 承载知识库解析、索引、检索等能力，替代原 Python FastAPI 服务。
  - 暴露统一命令接口供前端调用，可视需要扩展 HTTP/WebSocket 代理。
- **多模型调度**：在前端抽象统一 LLM Provider SDK，由 Rust 负责本地敏感数据存储与调用，避免 Key 泄露。

## 目录规划
- `app/package.json`：Tauri 工作区脚本（`tauri dev`、`tauri build`）与前端依赖管理。
- `app/src-tauri/Cargo.toml`：Rust crate 定义，依赖 `tauri`、`serde`、`tauri-plugin-*` 等。
- `app/src-tauri/tauri.conf.json`：多平台打包配置（bundle identifier、图标、更新机制）。
- `app/src-tauri/src/main.rs`：入口文件，初始化窗口、插件、命令注册。
- `app/src-tauri/src/lib.rs`：业务主干，封装知识库、会话、问答等逻辑。
- `app/src-tauri/src/kv.rs`（计划）：用于抽象本地键值存储，管理会话历史与 API Key。

## 多模型与 API 管理
- **Provider 抽象**：定义统一的 `LLMProvider` 接口（`sendMessage`、`stream`、`listModels` 等）。
- **目标支持的 Provider**：
  1. 豆包 (火山方舟 OpenAI 接口兼容)
  2. ChatGPT (OpenAI API / 新接口)
  3. Gemini (Google Generative AI)
  4. Grok (xAI)
- **API 管理页面**：
  - 新增 `/settings/apis` 路由，支持添加 / 编辑 / 删除 Provider Key。
  - 提供 Key 测试按钮以及默认 Provider 设定。
  - 展示限额与配额信息（若 Provider 支持）。
- **会话策略**：
  - 每个会话绑定单一模型，禁止会话内切换模型。
  - 支持复制会话并切换模型生成新会话。
  - 会话列表支持搜索、按时间排序、按 Provider 过滤。

## 本地数据存储
- **API Key**：建议组合使用 `tauri-plugin-store` 与 `tauri-plugin-secure-storage`，在本地加密保存。
- **会话与消息**：短期可用 JSON 文件持久化，后续可抽象 KV 层或引入 SQLite。
- **知识库缓存**：存放于系统应用数据目录，例如
  - Windows: `%APPDATA%/KnowledgeQA/`
  - macOS: `~/Library/Application Support/KnowledgeQA/`
- **同步策略**：预留导出 / 导入能力，方便备份与多设备迁移。

## 构建与打包
- 使用统一 npm 脚本驱动前端与 Tauri：`npm run dev`、`npm run build`、`npm run tauri`.
- `tauri.conf.json` 需配置：
  - `.env` / `.env.development` / `.env.production` 等环境变量文件。
  - `bundle.windows`：代码签名、图标、VC++ Runtime 依赖。
  - `bundle.macos`：Bundle Identifier、签名与 Notarization（可通过 CI 实现）。
  - 自定义协议 `knowledgeqa://` 方便唤起与深链。
- CI/CD（GitHub Actions）：
  - 使用 `tauri-action` 自动打包 Windows `.msi/.exe` 与 macOS `.dmg`。
  - 将产物上传至 Release，结合语义化版本发布。

## 渐进式迁移建议
1. **通信打通**：完成 Webview 与 Rust 命令通道，确保前端可以调用本地命令替换 HTTP。
2. **迁移前端**：将原 `frontend` 代码迁移至 `app/src`，适配 Tauri 运行环境与资产路径。
3. **迁移后端能力**：用 Rust 重写知识库 ingest / 检索 / 问答能力（当前版本提供简化实现，后续可逐步增强向量化检索、多模型调用）。
4. **多模型 Provider**：封装 Provider SDK，接入 Key 管理与模型切换。
5. **会话管理增强**：完善历史持久化、搜索、筛选等能力。
6. **打包与 QA**：补齐 Installer、自动更新、回归测试与发布流水线。

## 开放问题与补充建议
1. **PDF 与富文本解析**：当前 Rust 实现只支持 TXT/Markdown，若要兼容 PDF 需引入 PDF 解析库或通过外部服务处理。
2. **向量检索能力**：简化版使用关键词匹配，后续建议接入 Embedding 服务（如火山方舟 / OpenAI）并存储向量，用于更精准检索。
3. **多模型策略**：需确定各 Provider 的限流策略、错误处理、模型列表缓存方案。
4. **离线部署**：如果需要完全离线能力，需评估离线 Embedding / 本地模型方案。
5. **安全合规**：API Key 存储、崩溃日志、数据备份等需结合企业安全策略制定。
6. **测试体系**：建议补充单元测试（Rust + React）、端到端测试（Tauri e2e/Playwright）以及打包前的冒烟脚本。

> 当前改造已实现基础的本地知识库 ingest / 检索与会话存储。上述开放问题可作为后续迭代的优先事项清单。
