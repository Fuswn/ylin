<div align="center">

# ylin

**A fast, lightweight Markdown editor built with Tauri 2 + Rust**

[English](#english) | [中文](#中文)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2-blue?logo=tauri)](https://v2.tauri.app)
[![Rust](https://img.shields.io/badge/Rust-1.77+-orange?logo=rust)](https://www.rust-lang.org)

</div>

---

<a id="english"></a>

## Features

- **Real-time Preview** — Switch between editing and reading mode instantly
- **Syntax Highlighting** — Code blocks rendered with highlight.js (all languages)
- **File Tree** — Lazy-loading sidebar for browsing folders and `.md` files
- **Three Themes** — Dark, Light, and Sepia (eye-care)
- **Markdown Toolbar** — Quick formatting: headings, bold, italic, code, lists, links, images, tables
- **Export** — Save as HTML or print to PDF via browser
- **Drag & Drop** — Drop `.md` files directly into the editor
- **Keyboard Shortcuts** — Full set of shortcuts for efficient editing
- **Native Performance** — Rust backend with tiny memory footprint (~15MB)
- **Cross-platform** — Windows (installer included), macOS and Linux support via Tauri

## Screenshots

<!-- Add screenshots here -->
<!-- ![ylin screenshot](docs/screenshot.png) -->

## Installation

### Download

Download the latest release from the [Releases](https://github.com/Fuswn/ylin/releases) page.

### Build from Source

**Prerequisites:** [Node.js](https://nodejs.org/) (v18+), [Rust](https://www.rust-lang.org/tools/install) (v1.77.2+), platform-specific [Tauri dependencies](https://v2.tauri.app/start/prerequisites/)

```bash
# Clone the repository
git clone https://github.com/Fuswn/ylin.git
cd ylin

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build
```

The built executable will be at `src-tauri/target/release/ylin.exe` (Windows).

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | New file |
| `Ctrl+O` | Open file |
| `Ctrl+Shift+O` | Open folder |
| `Ctrl+S` | Save |
| `Ctrl+Shift+S` | Save as |
| `Ctrl+B` | Toggle sidebar / Bold (in editor) |
| `Ctrl+I` | Italic (in editor) |
| `Ctrl+K` | Insert link (in editor) |
| `Ctrl+P` | Toggle reading mode |
| `Tab` | Insert 4 spaces (in editor) |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Tauri 2](https://v2.tauri.app) |
| Backend | Rust, [rfd](https://github.com/PolyMeilex/rfd) (native dialogs) |
| Frontend | Vanilla JavaScript (no framework, no bundler) |
| Markdown | [markdown-it](https://github.com/markdown-it/markdown-it) |
| Syntax Highlighting | [highlight.js](https://highlightjs.org/) |

## Project Structure

```
ylin/
├── src/                  # Frontend (served as static files)
│   ├── index.html
│   ├── js/               # App modules (app, editor, preview, file-tree, themes, toolbar)
│   ├── lib/              # Vendored libs (markdown-it, highlight.js)
│   └── styles/           # CSS (themes, editor, preview, toolbar, etc.)
├── src-tauri/            # Rust backend
│   ├── src/              # Tauri commands & file operations
│   ├── tauri.conf.json   # Tauri configuration
│   └── Cargo.toml
└── package.json
```

## Contributing

Contributions are welcome! Feel free to open an [Issue](https://github.com/Fuswn/ylin/issues) or submit a [Pull Request](https://github.com/Fuswn/ylin/pulls).

1. Fork this repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the [MIT License](LICENSE).

---

<a id="中文"></a>

<div align="center">

# ylin

**基于 Tauri 2 + Rust 构建的快速、轻量级 Markdown 编辑器**

</div>

## 功能特性

- **实时预览** — 编辑模式与阅读模式一键切换
- **语法高亮** — 代码块使用 highlight.js 渲染（支持所有语言）
- **文件树** — 侧边栏懒加载，浏览文件夹和 `.md` 文件
- **三种主题** — 深色、浅色、护眼（Sepia）
- **Markdown 工具栏** — 快速格式化：标题、粗体、斜体、代码、列表、链接、图片、表格
- **导出功能** — 导出为 HTML 或通过浏览器打印为 PDF
- **拖放支持** — 直接拖放 `.md` 文件到编辑器
- **快捷键** — 完整的快捷键支持，高效编辑
- **原生性能** — Rust 后端，极小内存占用（约 15MB）
- **跨平台** — 支持 Windows（含安装程序）、macOS 和 Linux

## 截图

<!-- 在此添加截图 -->
<!-- ![ylin 截图](docs/screenshot.png) -->

## 安装

### 下载

从 [Releases](https://github.com/Fuswn/ylin/releases) 页面下载最新版本。

### 从源码构建

**前置要求：** [Node.js](https://nodejs.org/)（v18+）、[Rust](https://www.rust-lang.org/tools/install)（v1.77.2+）、对应平台的 [Tauri 依赖](https://v2.tauri.app/start/prerequisites/)

```bash
# 克隆仓库
git clone https://github.com/Fuswn/ylin.git
cd ylin

# 安装依赖
npm install

# 开发模式运行
npm run dev

# 生产构建
npm run build
```

构建产物位于 `src-tauri/target/release/ylin.exe`（Windows）。

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+N` | 新建文件 |
| `Ctrl+O` | 打开文件 |
| `Ctrl+Shift+O` | 打开文件夹 |
| `Ctrl+S` | 保存 |
| `Ctrl+Shift+S` | 另存为 |
| `Ctrl+B` | 切换侧边栏 / 粗体（编辑器内） |
| `Ctrl+I` | 斜体（编辑器内） |
| `Ctrl+K` | 插入链接（编辑器内） |
| `Ctrl+P` | 切换阅读模式 |
| `Tab` | 插入 4 个空格（编辑器内） |

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | [Tauri 2](https://v2.tauri.app) |
| 后端 | Rust、[rfd](https://github.com/PolyMeilex/rfd)（原生对话框） |
| 前端 | 原生 JavaScript（无框架、无打包工具） |
| Markdown 解析 | [markdown-it](https://github.com/markdown-it/markdown-it) |
| 语法高亮 | [highlight.js](https://highlightjs.org/) |

## 项目结构

```
ylin/
├── src/                  # 前端（直接作为静态文件提供）
│   ├── index.html
│   ├── js/               # 应用模块（app、editor、preview、file-tree、themes、toolbar）
│   ├── lib/              # 第三方库（markdown-it、highlight.js）
│   └── styles/           # 样式（主题、编辑器、预览、工具栏等）
├── src-tauri/            # Rust 后端
│   ├── src/              # Tauri 命令与文件操作
│   ├── tauri.conf.json   # Tauri 配置
│   └── Cargo.toml
└── package.json
```

## 贡献

欢迎贡献！请随时提交 [Issue](https://github.com/Fuswn/ylin/issues) 或 [Pull Request](https://github.com/Fuswn/ylin/pulls)。

1. Fork 本仓库
2. 创建特性分支（`git checkout -b feature/amazing-feature`）
3. 提交更改（`git commit -m 'Add amazing feature'`）
4. 推送到分支（`git push origin feature/amazing-feature`）
5. 发起 Pull Request

## 许可证

本项目基于 [MIT 许可证](LICENSE) 开源。
