
# MarkWright

> 专业本地 Markdown 编辑器 · Tauri 2 + Vue 3 · 完全离线 · 零云同步

[![Version](https://img.shields.io/badge/version-0.4.8-blue)](https://github.com/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)](https://github.com/)
[![Tauri](https://img.shields.io/badge/Tauri-2-328bf0)](https://tauri.app)
[![Vue](https://img.shields.io/badge/Vue-3-42b883)](https://vuejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178c6)](https://www.typescriptlang.org)

**MarkWright** 是一款为认真写作而生的桌面 Markdown 编辑器。它将专业代码编辑器的编辑内核、现代化笔记软件的知识网络与写作辅助工具，整合进一个**完全本地、零联网**的应用中。

- 🖥️ 桌面原生应用（Windows / macOS / Linux）
- ⚡ CodeMirror 6 编辑内核，实时预览
- 🔒 本地加密 Vault（AES-256-GCM），数据不出本机
- 📦 轻量（便携版约 8.7 MB），重型依赖按需加载
<img width="1920" height="1025" alt="1" src="https://github.com/user-attachments/assets/0c425f4b-a7d8-44c2-9664-9e468a226843" />
<img width="1920" height="1025" alt="2" src="https://github.com/user-attachments/assets/8ffb00ef-d233-471d-b60a-ff9a27c5bf0b" />
<img width="1920" height="1025" alt="3" src="https://github.com/user-attachments/assets/fa4493bd-4c54-4828-ac72-0d68f5924ea5" />
<img width="1920" height="1025" alt="4" src="https://github.com/user-attachments/assets/3d61f1dc-ae87-46af-a9ba-98202f08b886" />
---

## 📑 目录

- [特性](#特性)
- [快速开始](#快速开始)
- [从源码构建](#从源码构建)
- [使用指南](#使用指南)
- [隐私与安全](#隐私与安全)
- [项目结构](#项目结构)
- [贡献](#贡献)
- [许可证](#许可证)

---

## ✨ 特性

### 编辑与预览

- **专业编辑内核**：CodeMirror 6（与 VS Code 同源），行号、语法高亮、括号匹配、多光标、撤销重做、搜索
- **实时预览**：markdown-it + highlight.js，支持任务列表、表格、引用、锚点
- **多 Tab 编辑**：同时编辑多个文档，支持关闭 / 中键关闭 / 固定；每个 Tab 独立保留滚动位置、光标选区与撤销历史
- **文件树 / 工作区**：打开文件夹浏览与新建，顶部可随时切换 / 刷新 / 关闭工作区
- **大纲面板**：解析 H1–H6，当前章节高亮、点击跳转；标题过多时启用虚拟滚动

### 知识网络

- **双向链接**：`[[文件名]]` / `[[文件名|别名]]` 自动渲染为可点击内部链接
- **反向链接 + 标签云**：`#tag` 自动聚合，并发扫描并显示引用行号与上下文
- **富媒体代码块**：Mermaid 图表、KaTeX 公式、Chart.js 图表、Kanban 看板，直接在 Markdown 中增强表达

### 写作辅助

- **专注模式**（F11）：隐藏全部 UI，中央番茄钟进度环 + 字数目标
- **番茄钟 + 写作统计**：日 / 周 / 月字数热力图、趋势折线、累计统计（SQLite 持久化）
- **Flesch 易读性评分**、**阅读时长预估**、**白噪音**（雨 / 咖啡馆 / 键盘 / 森林，Web Audio 程序化生成）
- **日记模板**（Ctrl+J）：今日 / 周报 / 月度 / 读书笔记 + 自定义模板

### 效率与个性化

- **命令面板**（Ctrl+Shift+P）、**快速打开**（Ctrl+P）、**全局搜索替换**（Ctrl+H）、**跳转到行**（Ctrl+G）
- **6 主题 × 6 维度**：颜色 / 字体 / 纹理 / 装饰 / 动效 / 密度
- **可拖拽分屏**（单栏 / 双栏 / 仅预览）、**可拖拽侧边栏**（200–560px 持久化）、**滚动同步**
- **导出**：PDF（系统打印）、HTML（独立文件）、DOCX（Word）、复制富文本

### 性能

- 首屏按需分包，重型依赖（mermaid / katex / chart.js / docx）**按需动态加载**
- 预览防抖重渲染、视口内懒渲染（IntersectionObserver）、大纲虚拟滚动、工作区 8 路并发扫描

---

## 🚀 快速开始

前往 [Releases](../../releases) 下载对应平台安装包：

| 平台 | 产物 |
|------|------|
| Windows | `markwright.exe`（便携版，双击即用）· `.msi` · `.exe`（NSIS） |
| macOS | `.dmg` · `.app` |
| Linux | `.deb` · `.rpm` · `.AppImage` |

> 无需安装、注册或登录；首次运行在系统应用数据目录创建本地数据库与配置。
> 关联 `.md` / `.markdown` 文件：安装后双击 Markdown 文件即可用本程序打开；程序已在运行时再次双击，会唤起已有窗口而非新开进程。

---

## 🛠 从源码构建

### 环境要求

- **Node.js** 18+（建议 LTS）
- **Rust** 1.77+（稳定版）
- **PowerShell 7+**（用于一键打包脚本；Windows 开发亦可）
- 包管理器：`npm` 或 `bun`

### 开发模式（热更新窗口）

```bash
npm install
npm run tauri dev
```

### 仅前端预览

```bash
npm run dev
```

### 类型检查与构建

```bash
npm run lint   # 类型检查 (vue-tsc --noEmit)
npm run build  # 类型检查 + 前端构建
```

### 一键打包发布

`scripts/build-release.ps1` 会依次完成「依赖安装 → 前端构建 → Rust release → 收集安装包 → 生成说明与校验」，并按当前系统选择产物：

```powershell
pwsh ./scripts/build-release.ps1                              # 常规发布
pwsh ./scripts/build-release.ps1 -CargoMirror -Clean         # 使用 crates 镜像并清理旧产物
pwsh ./scripts/build-release.ps1 -SkipInstall -SkipFrontend  # 跳过依赖/前端，直接打包
```

产物输出到 `发布版/<版本>/<平台>/`，含安装包、`安装说明.md` 与 `checksums.csv`（SHA256）。

> 国内镜像安装依赖：`$env:NPM_CONFIG_REGISTRY = "https://registry.npmmirror.com"`

---

## 📖 使用指南

常用快捷键：

| 快捷键 | 功能 | 快捷键 | 功能 |
|--------|------|--------|------|
| Ctrl/⌘ + N | 新建 | Ctrl/⌘ + ⇧ + P | 命令面板 |
| Ctrl/⌘ + O | 打开 | Ctrl/⌘ + P | 快速打开 |
| Ctrl/⌘ + S | 保存 | Ctrl/⌘ + H | 查找替换 |
| Ctrl/⌘ + B / I / K | 加粗 / 斜体 / 链接 | F11 | 专注模式 |
| Ctrl/⌘ + G | 跳转到行 | Ctrl/⌘ + J | 日记模板 |
| Ctrl/⌘ + \\ | 切换视图 | Ctrl/⌘ + , | 设置 |

增强语法（Mermaid / KaTeX / Chart.js / Kanban）示例见
[`doc/介绍文章与宣讲素材.md`](doc/介绍文章与宣讲素材.md) 与
[`doc/RELEASE_NOTES.md`](doc/RELEASE_NOTES.md)。

---

## 🔒 隐私与安全

MarkWright **完全离线运行**，不产生任何遥测或数据上报。

- **本地加密 Vault**：AES-256-GCM，密钥由主密码派生，全程零联网
- **加密文件格式**：`.md` → `.md.vault`（`MWV1` 魔数，含随机 nonce；非本程序生成的文件会被拒绝）
- **主密码仅在内存**：用完即清，绝不写入 `localStorage`；仅保存一份「密文校验串」于原生（Rust）侧设置
- **磁盘零明文**：正文以加密形态落盘，不保留明文备份

---

## 📁 项目结构

```
markwright/
├── src/                  # Vue 3 + TypeScript 前端
│   ├── components/       # 视图组件（编辑器 / 预览 / 面板 / 对话框）
│   ├── composables/      # 业务逻辑（命令 / 渲染 / 加密 / 统计 …）
│   ├── stores/           # Pinia 状态
│   ├── data/themes.ts    # 6 套主题定义
│   └── styles/           # 设计令牌与样式
├── src-tauri/            # Rust 后端（Tauri 2）
│   ├── src/{main,lib}.rs # 命令实现（SQLite + AES-256-GCM）
│   ├── capabilities/     # 权限声明
│   ├── icons/            # 应用图标
│   ├── tauri.conf.json
│   └── Cargo.toml
├── scripts/
│   └── build-release.ps1 # 一键打包（Windows / macOS / Linux）
├── public/
├── tests/                # 前端 Vitest 单测
└── doc/                  # 文档与素材
```

---

## 🤝 贡献

欢迎 Issue 与 Pull Request。

本地开发：

```bash
npm install
npm run tauri dev
```

提交前请保证：

```bash
npm run lint                 # 前端类型检查
npx vitest run              # 前端测试
cd src-tauri && cargo test --lib   # 后端测试
```

---

## 📄 许可证

[MIT](LICENSE) © MarkWright
