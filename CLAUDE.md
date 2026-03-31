# ylin - Markdown Editor

## Project Overview

ylin 是一个轻量级 Markdown 编辑器，基于 **Tauri 2 + Rust** 后端 + **原生 JavaScript**（无框架、无打包器）前端构建。

- **仓库**: https://github.com/Fuswn/ylin
- **平台**: Windows（NSIS 安装包）
- **分支**: `main` 为稳定分支，`develop` 为开发分支

## Architecture

### Frontend (src/)

纯 HTML/CSS/JS，无 React/Vue 等框架，无 Vite/Webpack 打包器。`src/` 目录直接作为 `frontendDist` 提供给 Tauri。

**JS 模块** — 全局单例对象模式，通过 `window` 作用域暴露：

| 文件 | 对象 | 职责 |
|------|------|------|
| `src/js/app.js` | `App` | 主控制器：文件操作、快捷键、搜索、拖拽、侧栏 |
| `src/js/editor.js` | `Editor` | 编辑器：textarea、行号、选区操作、undo |
| `src/js/file-tree.js` | `FileTree` | 文件树：懒加载、展开/折叠、驱动器切换 |
| `src/js/preview.js` | `Preview` | 预览：markdown-it 渲染、HTML/PDF 导出模板 |
| `src/js/toolbar.js` | `Toolbar` | 工具栏：Markdown 格式化按钮 |
| `src/js/themes.js` | `ThemeManager` | 主题：dark/light/sepia 切换，localStorage 持久化 |

**CSS 文件** — 按组件拆分，使用 CSS 变量实现主题：

| 文件 | 内容 |
|------|------|
| `src/styles/main.css` | 全局布局、标题栏、状态栏、菜单、拖拽遮罩 |
| `src/styles/themes.css` | 三套主题的 CSS 变量定义 |
| `src/styles/editor.css` | 编辑器面板、行号、搜索栏样式 |
| `src/styles/file-tree.css` | 侧边栏、文件树项样式 |
| `src/styles/preview.css` | 预览面板排版 |
| `src/styles/toolbar.css` | Markdown 工具栏按钮 |

**第三方库** — 本地引入（`src/lib/`），非 CDN：
- `markdown-it.min.js` — Markdown 解析
- `highlight.min.js` — 代码高亮
- `hljs-*.css` — highlight.js 主题样式

### Backend (src-tauri/)

Rust + Tauri 2.10.3，通过 `#[tauri::command]` 暴露给前端：

| 文件 | 内容 |
|------|------|
| `src-tauri/src/lib.rs` | 所有 Tauri 命令：对话框、文件读写、PDF 导出、目录读取、驱动器列表 |
| `src-tauri/src/file_ops.rs` | `FileNode` 结构体 + `read_dir_one_level()` 目录遍历（仅 .md/.markdown 文件） |
| `src-tauri/src/main.rs` | 入口，调用 `app_lib::run()` |

**关键 Tauri 命令**:
- `dialog_open_file` / `dialog_open_folder` / `dialog_save_md` / `dialog_save_html` / `dialog_save_pdf` — 文件对话框
- `read_dir_tree` — 读取一级目录内容
- `read_md_file` / `write_md_file` — 文件读写
- `export_pdf` — 通过 headless Chromium (Edge/Chrome) 生成 PDF
- `get_drives` / `get_parent_dir` — 导航辅助

### State Management

无状态管理库。状态存储在各模块对象属性中：
- `App._currentFile` — 当前文件路径
- `App._isReadingMode` — 阅读模式开关
- `Editor._dirty` — 未保存标记
- `FileTree._currentRoot` — 当前根目录
- `ThemeManager.current` — 当前主题

**持久化**: 仅 `localStorage` 两个键：
- `md-editor-theme` — 主题
- `md-editor-last-folder` — 上次打开的文件夹（启动时自动恢复）

## Key Implementation Details

### Search (Ctrl+F)

自定义搜索实现，**不使用 WebView2 原生 find-in-page**（会导致 UI 卡死）。

统一搜索模块架构：
- `_findMatches()` — 根据当前模式搜索内容（编辑模式搜原文，阅读模式搜渲染后 DOM 文本）
- `_doSearch(direction)` — 共用索引导航
- `_navigateToMatch()` — 模式分发渲染：
  - 编辑模式：`setSelectionRange` + 手动计算 `scrollTop`（textarea 不支持 `scrollIntoView`）
  - 阅读模式：DOM TreeWalker + `<mark>` 标签 + `scrollIntoView`

快捷键：Enter/Shift+Enter（搜索框内）、F3/Shift+F3（编辑器内）、Escape 关闭

### File Tree

懒加载模式：仅加载一级目录。展开文件夹时显示"加载中..."占位，`_renderNodes` 渲染前先 `innerHTML = ''` 清除占位。

### Drag & Drop

使用 Tauri 2 的 `getCurrentWebviewWindow().onDragDropEvent()` API，需要 `tauri.conf.json` 中 `dragDropEnabled: true`。

### Keyboard Shortcuts

全局快捷键在 `_bindKeyboardShortcuts()` 中注册。搜索框聚焦时跳过其他快捷键处理（防止按键冲突）。

## Development

```bash
npm run tauri dev    # 开发模式
npm run tauri build  # 构建安装包（输出到 src-tauri/target/release/bundle/nsis/）
```

## Known Constraints

- WebView2 原生 Ctrl+F 已被屏蔽（`e.preventDefault()`），因为会在特定条件下导致 UI 完全卡死
- textarea 的 `setSelectionRange` 不会自动滚动，需要手动计算行高设置 `scrollTop`
- 阅读模式搜索每次导航需要重新渲染 preview（因为 `<mark>` 标签会改变 DOM 结构）
- PDF 导出依赖系统安装的 Edge 或 Chrome 浏览器
