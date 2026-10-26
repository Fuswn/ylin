# ylin - Markdown Editor

## Project Overview

ylin 是一个轻量级 Markdown 编辑器，基于 **Tauri 2 + Rust** 后端 + **原生 JavaScript**（无框架、无打包器）前端构建。

- **仓库**: https://github.com/Fuswn/ylin
- **平台**: Windows（NSIS 安装包）、macOS（.app / .dmg）
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

**其它资源**：`src/assets/logo.png`（关于面板 Logo，由图标脚本生成）；`docs/`（README 截图）

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
| `src-tauri/tauri.macos.conf.json` | macOS 专属配置（按 JSON Merge Patch 合并到 `tauri.conf.json`）：打包目标 app/dmg、.md 文件关联、ad-hoc 签名 |
| `src-tauri/icons/` | 应用图标（生成产物，见"应用图标"）；`icons/source/` 下是 SVG 源文件和 `build_icons.py` |

**关键 Tauri 命令**:
- `dialog_open_file` / `dialog_open_folder` / `dialog_save_md` / `dialog_save_html` / `dialog_save_pdf` — 文件对话框
- `dialog_message` / `dialog_confirm` — 原生消息框 / 确认框（替代 `alert` / `confirm`，见"跨平台"）
- `take_pending_file` — 取走系统请求打开的文件（双击 / "打开方式"）
- `read_dir_tree` — 读取一级目录内容
- `read_md_file` / `write_md_file` — 文件读写
- `export_pdf` — 通过 headless Chromium (Edge/Chrome) 生成 PDF
- `get_drives` / `get_parent_dir` — 导航辅助

**插件**：`tauri-plugin-log`（仅 debug）；`tauri-plugin-opener` 用系统浏览器 / 邮件客户端打开链接。opener 锁定在 `~2.5`（2.6+ 要求 tauri 2.12），权限只开了 `opener:allow-open-url` + `opener:allow-default-urls`（http / https / mailto / tel）

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

快捷键：Enter/Shift+Enter（搜索框内）、F3/Shift+F3（编辑器内，macOS 另有 ⌘G/⇧⌘G）、Escape 关闭

### File Tree

懒加载模式：仅加载一级目录。展开文件夹时显示"加载中..."占位，`_renderNodes` 渲染前先 `innerHTML = ''` 清除占位。

### Drag & Drop

使用 Tauri 2 的 `getCurrentWebviewWindow().onDragDropEvent()` API，需要 `tauri.conf.json` 中 `dragDropEnabled: true`。

### Keyboard Shortcuts

全局快捷键在 `_bindKeyboardShortcuts()` 中注册。搜索框聚焦时跳过其他快捷键处理（防止按键冲突）。

### 跨平台（Windows / macOS）

- **对话框**：前端不要直接用 `alert()` / `confirm()` —— macOS 的 WKWebView 中 `alert` 无效、`confirm` 恒返回 `false`。统一用 `App._alert()` / `App._confirmDiscard()`（后端 `dialog_message` / `dialog_confirm`，基于 rfd 原生对话框）
- **系统打开文件**：Windows 通过命令行参数传入；macOS 通过 Apple Event（`RunEvent::Opened`），可能在前端加载前或运行中到达。两者都存入 `PendingFile`，前端在启动时和收到 `open-file` 事件时调用 `take_pending_file` 取走
- **修饰键**：由 `App._isMac` 决定，macOS 用 ⌘，其他平台用 Ctrl（macOS 的 Ctrl+字母是系统文本导航，不能拦截）；字母键统一转小写比较（Shift / Caps Lock 会改变 `e.key` 大小写）
- **快捷键显示**：HTML 中统一写 `Ctrl+X`，macOS 上由 `_applyPlatformLabels()` 替换为 `⌘X`
- **驱动器列表**：macOS 上 `get_drives` 返回主目录、`/` 和 `/Volumes` 下的其他卷

### 界面与主题约定

- **主题变量分层**：标题栏 / 侧栏 / 状态栏用 `--chrome-bg` 构成外框，工具栏 / 编辑器 / 预览用 `--bg` 作为内容区。新增主题要把 `themes.css` 里的变量全部定义一遍。白字压在强调色上时用 `--accent-fill`（深色主题的 `--accent` 偏亮，白字对比度不够）
- **平台标记**：`index.html` 头部的内联脚本在 `<html>` 上加 `.platform-mac`（`<body>` 的 class 被主题占用，会被 `ThemeManager.apply` 整体覆盖），`App._isMac` 读的就是这个标记
- **macOS 标题栏**：`tauri.macos.conf.json` 用 `titleBarStyle: Overlay` 让交通灯叠在自定义标题栏上。Merge Patch 会整体替换 `app.windows` 数组，所以**改窗口尺寸等配置时两个配置文件都要改**。`trafficLightPosition` 和 `.platform-mac #titlebar` 的高度（44px）、左内边距（82px）是配套调好的
- **窗口拖拽**：`data-tauri-drag-region` 只对点击目标元素本身生效（子元素不继承），标题文字靠 `pointer-events: none` 把点击穿透给标题栏；需要 `core:window:allow-start-dragging` 权限
- **原生窗口主题**：`ThemeManager.apply` 会调用 `setTheme`，让 Windows 标题栏、macOS 交通灯和系统对话框跟随深浅色；需要 `core:window:allow-set-theme` 权限
- **编辑器行号**：`#line-numbers` 和 `#editor` 必须使用相同的 `line-height`（px）和上下内边距，否则行号会错位
- **图标**：文件树图标在 `FileTree._icons`（内联 SVG），不要再用 emoji；关于面板的 Logo 是 `src/assets/logo.png`（由图标脚本生成，见"应用图标"）
- **链接**：`App._initExternalLinks()` 全局拦截 `<a>` 点击，`http(s):` / `mailto:` 交给 opener 打开，其它链接直接忽略。Tauri 默认允许 webview 导航到外部网址，不拦截的话点一下预览里的链接，整个编辑器界面就被网页替换，未保存的内容会丢
- **关于面板**：应用内的 `#about-overlay`（不是系统对话框，系统对话框里放不了可点击链接），版本号通过 `app.getVersion()` 读取 `tauri.conf.json`；面板打开时只响应 Esc，其它快捷键都被屏蔽

### 应用图标

- **设计**：读作 Markdown 的 `# ylin`。左侧深色"源码"区放蓝色 `#`，右侧纸色"渲染"区放 "ylin" 标题、两行正文和蓝色光标。字标用 Nunito Bold（SIL OFL 1.1），已转成路径，SVG 里没有 `<text>`，不依赖字体。配色：深色区 `#3B3E48→#22242B`，纸面 `#FFFDF8→#F1E8D8`，`#` 和光标 `#5E95FF`，字标 `#2E2A24`，正文线 `#B3A690`
- **源文件**（`src-tauri/icons/source/`）：`icon-mac*.svg` 按苹果网格绘制（824px 主体 + 投影），生成 `icon.icns` 和 `icon.png`（`tauri dev` 时的程序坞图标）；`icon-full*.svg` 铺满画布、无投影，生成 `icon.ico`、其它 PNG、Store logo 和关于面板的 `src/assets/logo.png`。`*-small.svg`（`# y`）用于 40px 及以下，那么小时 "ylin" 已经看不清
- **重新生成**：改完 SVG 后执行 `python3 src-tauri/icons/source/build_icons.py`（需要 macOS + Google Chrome）。**不要用 `npx tauri icon`**，它只认一张源图，会丢掉 Mac / Windows 两种版式和小尺寸版，还会额外生成移动端图标
- **Windows 安装程序**：setup.exe 的图标要在 `tauri.conf.json` 的 `bundle.windows.nsis.installerIcon` 中指定（指向 `icons/icon.ico`），否则会显示 NSIS 默认图标（v1.1.0 及之前的安装程序都是默认图标）。卸载程序仍是 NSIS 默认图标：`uninstallerIcon` 字段要 Tauri 2.12 以上才支持，当前 tauri-build 2.5 遇到这个字段会直接编译失败
- 换图标后如果程序坞 / 访达还显示旧图标，是 macOS 图标缓存的问题，执行 `killall Dock` 即可

## Git Workflow

- **分支模型**: 在 `develop` 分支开发，完成后合并到 `main`。禁止直接在 `main` 上提交代码。
- **版本号**: 发版前同步修改三处：`package.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`，再跑一次 cargo 更新 `Cargo.lock`。关于面板、安装包 / DMG 文件名都读取 `tauri.conf.json` 的版本号。v1.0.1 和 v1.0.2 发布时漏改过，安装包里一直显示 1.0.0；当前版本是 1.1.0
- **Release 规范**: `gh release create` 的 `--title` 只写版本号（如 `v1.1.0`），不附加描述文字。详细更新内容写在 `--notes` 中。

## Development

```bash
npm run dev    # 开发模式
npm run build  # 构建安装包（Windows 输出到 src-tauri/target/release/bundle/nsis/，macOS 输出到 bundle/macos/ 和 bundle/dmg/）

# macOS 发版用通用包（Apple Silicon + Intel），需先执行 rustup target add x86_64-apple-darwin aarch64-apple-darwin
npm run build -- --target universal-apple-darwin   # 输出到 src-tauri/target/universal-apple-darwin/release/bundle/
```

## Known Constraints

- WebView2 原生 Ctrl+F 已被屏蔽（`e.preventDefault()`），因为会在特定条件下导致 UI 完全卡死
- textarea 的 `setSelectionRange` 不会自动滚动，需要手动计算行高设置 `scrollTop`
- 阅读模式搜索每次导航需要重新渲染 preview（因为 `<mark>` 标签会改变 DOM 结构）
- PDF 导出依赖系统安装的 Edge 或 Chrome 浏览器（macOS 上需装在 /Applications，Safari 不支持）
- macOS 包只做了 ad-hoc 签名、未公证，从网上下载后首次打开会被 Gatekeeper 拦截；正式分发需要 Apple Developer ID 签名 + 公证
