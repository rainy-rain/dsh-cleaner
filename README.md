# DSH 会话清理工具

> 一个安全、简单、可视化的 DSH（DeepSeek Harness）会话管理工具。
> 用于删除、归档、置顶本地会话记录，附带自动备份与可回滚保护。

![Electron](https://img.shields.io/badge/Electron-44.x-47848F?logo=electron&logoColor=white)
![Node](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white)
![Platform](https://img.shields.io/badge/Platform-Windows-0078D6?logo=windows&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## ✨ 功能特性

| 功能 | 说明 |
|------|------|
| 📋 **会话列表** | 展示标题、大小、最后修改时间、所属工作区、归档/置顶状态 |
| 🗑️ **删除会话** | 一次性清理会话正文、索引缓存和 `workspace.json` 里的注册引用 |
| 📦 **归档 / 取消归档** | 把不想看的对话收起来，随时恢复 |
| 📌 **置顶 / 取消置顶** | 重要会话排到列表最前面 |
| ☑️ **批量选择** | 全部勾选、全部取消，支持逐个勾选 |
| 👁️ **归档过滤** | 一键显示或隐藏已归档会话 |
| 💾 **自动备份** | 每次删除前自动备份 `workspace.json`，可回滚 |
| 📊 **实时统计** | 会话总数、已选中数量、选中总大小 |

---

## 🚀 快速开始

### 环境要求

- **Node.js** >= 18（[下载地址](https://nodejs.org/)）
- **Windows** 系统（macOS / Linux 理论可用，未测试）

### 安装与运行

```bash
# 1. 克隆仓库
git clone https://github.com/rainy-rain/dsh-cleaner.git
cd dsh-cleaner

# 2. 安装依赖
npm install

# 3. 启动应用
npm start
```

**或者**：Windows 下直接**双击 `启动工具.bat`** 即可。

> ⚠️ 首次启动会自动下载 Electron 运行时（约 100MB），请耐心等待；之后启动是秒开的。

---

## 📖 使用教程

### 1. 加载会话列表

应用启动后会自动扫描 `~/.dsh/sessions` 目录并列出所有会话。

如果列表为空或想刷新，点击 **「🔄 刷新列表」**。

### 2. 选择要删除的会话

- **单个勾选** — 点击会话左侧复选框
- **全部勾选 / 全部取消** — 使用顶部按钮
- 顶部会实时显示已选中数量和总大小

### 3. 删除会话

1. 勾选目标会话
2. 点击 **「🗑️ 删除选中」**
3. 在确认对话框中点击 **「确定删除」**
4. 等待完成提示

删除会同时清理三处：

| 位置 | 内容 |
|------|------|
| `~/.dsh/sessions/<分组目录>/<会话ID>/` | 会话正文日志 |
| `~/.dsh/storages/session_projcache/sessions/<会话ID>.json` | 会话索引缓存 |
| `~/.dsh/storages/workspace.json` | 工作区成员、归档、置顶引用 |

### 4. 归档与置顶

- 点击会话右侧 **「📦 归档」** / **「↩️ 取消归档」**
- 点击 **「📌 置顶」** / **「📍 取消置顶」**
- 这些操作只改 `workspace.json`，**不会删除任何文件**

### 5. 手动备份

点击 **「💾 备份当前状态」**，会在 `~/.dsh/storages/` 下生成
`workspace.json.bak-<时间戳>` 文件。

---

## 🛡️ 安全说明

1. **自动备份** — 每次删除前都会自动备份 `workspace.json`
2. **二次确认** — 删除操作必须经过确认对话框
3. **路径校验** — 所有文件操作都被限制在 `~/.dsh` 目录内
4. **隔离删除** — 只作用于会话自身的日志、缓存和注册项，不会碰共享的
   `attachments/` 与 `cache/` 目录

### ⚠️ 重要提醒

- 删除前请**先退出 DSH**，避免文件被占用
- **不要删除当前正在使用的会话**
- 删除后需要**重启 DSH** 才能看到列表变化
- 删除**不可撤销**，请谨慎操作

### 🔙 恢复备份

```powershell
# 找到备份文件
Get-ChildItem "$env:USERPROFILE\.dsh\storages\workspace.json.bak-*"

# 恢复（把 <时间戳> 换成实际值）
Copy-Item "$env:USERPROFILE\.dsh\storages\workspace.json.bak-<时间戳>" `
          "$env:USERPROFILE\.dsh\storages\workspace.json" -Force
```

---

## 📁 项目结构

```
dsh-cleaner/
├── index.js          # Electron 主进程：文件扫描、删除、备份逻辑
├── main.html         # 渲染进程：界面、样式与交互
├── package.json      # 项目配置与依赖
├── 启动工具.bat       # Windows 一键启动脚本
├── 说明.txt           # 简要说明
├── README.md         # 本文件
├── LICENSE           # MIT 开源协议
└── .gitignore        # Git 忽略规则
```

### 架构说明

本项目采用 Electron 经典的双进程模型：

```
┌──────────────────────────────────────────┐
│  main.html （渲染进程 / 前端）            │
│  界面渲染 · 用户交互 · 状态管理            │
└──────────────────────────────────────────┘
                    ↕  IPC (ipcRenderer ↔ ipcMain)
┌──────────────────────────────────────────┐
│  index.js （主进程 / 后端）               │
│  文件扫描 · 会话删除 · 备份恢复 · 配置读写  │
└──────────────────────────────────────────┘
```

### 可用的 IPC 接口

| 接口 | 作用 |
|------|------|
| `get-sessions` | 扫描并返回全部会话 |
| `delete-sessions` | 删除指定会话（含自动备份） |
| `toggle-archive` | 切换会话归档状态 |
| `toggle-pin` | 切换会话置顶状态 |
| `backup-current` | 手动备份 `workspace.json` |
| `get-backups` | 列出所有备份文件 |
| `restore-backup` | 从备份恢复 |
| `cleanup-backups` | 清空所有备份 |

---

## ❓ 常见问题

<details>
<summary><b>Q1: 首次启动很慢？</b></summary>

首次运行需要下载 Electron 运行时（约 100MB）。之后启动是秒开的。
</details>

<details>
<summary><b>Q2: 删除后 DSH 里还能看到？</b></summary>

需要**重启 DSH**。DSH 运行时内存中持有旧的会话列表，重启后会重新从磁盘读取。

另外，**不要在重启前使用 DSH 的归档/置顶/拖拽排序功能**——那会把内存里的旧列表写回 `workspace.json`。
</details>

<details>
<summary><b>Q3: 提示 "No handler registered for 'xxx'"？</b></summary>

说明 `index.js` 缺少对应的 IPC 接口。请确认你用的是最新版代码。
</details>

<details>
<summary><b>Q4: 应用无法启动？</b></summary>

1. 确认 Node.js 版本 >= 18：`node -v`
2. 重新安装依赖：`npm install`
3. 检查杀毒软件是否拦截了 Electron
</details>

<details>
<summary><b>Q5: 显示"没有找到会话"？</b></summary>

1. 确认 DSH 已安装并至少使用过一次
2. 检查 `C:\Users\<用户名>\.dsh\sessions` 目录是否存在
3. 点击「🔄 刷新列表」
</details>

---

## 🗺️ 后续计划

- [ ] 支持按大小 / 时间排序
- [ ] 会话标题搜索
- [ ] 备份管理界面（列表、恢复、清理）
- [ ] 支持自定义 DSH 数据目录
- [ ] 打包为免安装 `.exe`

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request。

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/your-feature`
3. 提交改动：`git commit -m "Add some feature"`
4. 推送分支：`git push origin feature/your-feature`
5. 提交 Pull Request

---

## 📄 开源协议

本项目基于 [MIT License](LICENSE) 开源。

---

## ⚠️ 免责声明

本工具仅用于管理**本地** DSH 会话数据，请勿用于其他用途。

删除操作不可撤销，虽然程序会尽力提供备份，但**因使用本工具造成的任何数据丢失，开发者不承担责任**。请在使用前自行确认并做好重要数据的额外备份。
