/**
 * app.js - Main application controller
 * @author Fusw
 */
const App = {
  _currentFile: null,
  _isReadingMode: false,
  _sidebarVisible: true,

  async init() {
    // Check Tauri API availability
    if (!window.__TAURI__) {
      console.error('[FATAL] window.__TAURI__ is not available!');
      document.getElementById('status-file').textContent = 'ERROR: Tauri API 未加载';
    } else {
      console.log('[OK] Tauri API loaded:', Object.keys(window.__TAURI__));
      if (window.__TAURI__.webviewWindow) {
        console.log('[OK] webviewWindow keys:', Object.keys(window.__TAURI__.webviewWindow));
      }
      if (window.__TAURI__.event) {
        console.log('[OK] event keys:', Object.keys(window.__TAURI__.event));
      }
    }

    // Init all modules
    ThemeManager.init();
    Editor.init();
    Preview.init();
    FileTree.init();
    Toolbar.init();

    // Wire up modules
    Editor.onChange((text) => {
      this._updateTitle();
      if (this._isReadingMode) {
        Preview.render(text);
      }
    });

    FileTree.onFileSelect((path) => {
      this._loadFile(path);
    });

    // Reading mode toggle
    document.getElementById('reading-mode-toggle').addEventListener('change', (e) => {
      this._toggleReadingMode(e.target.checked);
    });

    // Menu actions
    this._bindMenuActions();

    // Keyboard shortcuts
    this._bindKeyboardShortcuts();

    // Sidebar resize
    this._initResizeHandle();

    // Search bar
    this._initSearch();

    // Close menu dropdowns on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.menu-item')) {
        document.querySelectorAll('.menu-dropdown.show').forEach(d => d.classList.remove('show'));
      }
    });

    // Drag and drop
    this._initDragDrop();

    // Status
    document.getElementById('status-file').textContent = '就绪';

    // Check if a file was passed via CLI (e.g. double-click .md in Explorer)
    await this._loadCliFile();
  },

  async _loadCliFile() {
    try {
      const filePath = await window.__TAURI__.core.invoke('get_cli_file_path');
      if (filePath) {
        console.log('[CLI] Opening file from args:', filePath);
        await this._loadFile(filePath);

        // Also open the parent folder in the file tree
        const parentDir = await window.__TAURI__.core.invoke('get_parent_dir', { path: filePath });
        if (parentDir) {
          FileTree.setRoot(parentDir);
          if (!this._sidebarVisible) this._toggleSidebar();
        }
      }
    } catch (err) {
      console.error('[CLI] Failed to load file from args:', err);
    }
  },

  // ---- File Operations ----

  async _newFile() {
    if (Editor.isDirty() && !await this._confirmDiscard()) return;
    this._currentFile = null;
    Editor.setValue('', true);
    this._updateTitle();
    document.getElementById('status-file').textContent = '新文件';
  },

  async _openFile() {
    try {
      console.log('[openFile] invoking dialog_open_file...');
      const path = await window.__TAURI__.core.invoke('dialog_open_file');
      console.log('[openFile] result:', path);
      if (path) {
        await this._loadFile(path);
      }
    } catch (err) {
      console.error('[openFile] error:', err);
      alert('打开文件失败: ' + JSON.stringify(err));
    }
  },

  async _openFolder() {
    try {
      console.log('[openFolder] invoking dialog_open_folder...');
      const path = await window.__TAURI__.core.invoke('dialog_open_folder');
      console.log('[openFolder] result:', path);
      if (path) {
        FileTree.setRoot(path);
        if (!this._sidebarVisible) this._toggleSidebar();
      }
    } catch (err) {
      console.error('[openFolder] error:', err);
      alert('打开文件夹失败: ' + JSON.stringify(err));
    }
  },

  async _loadFile(filePath) {
    if (Editor.isDirty() && !await this._confirmDiscard()) return;
    try {
      const content = await window.__TAURI__.core.invoke('read_md_file', { path: filePath });
      this._currentFile = filePath;
      Editor.setValue(content, true);
      this._updateTitle();
      document.getElementById('status-file').textContent = this._fileName(filePath);

      // If in reading mode, update preview
      if (this._isReadingMode) {
        Preview.render(content);
      }
    } catch (err) {
      console.error('Failed to load file:', err);
      alert('无法打开文件: ' + err);
    }
  },

  async _saveFile() {
    if (!this._currentFile) {
      return this._saveFileAs();
    }
    try {
      await window.__TAURI__.core.invoke('write_md_file', {
        path: this._currentFile,
        content: Editor.getValue(),
      });
      Editor.markClean();
      this._updateTitle();
      document.getElementById('status-file').textContent = `已保存: ${this._fileName(this._currentFile)}`;
    } catch (err) {
      console.error('Save failed:', err);
      alert('保存失败: ' + err);
    }
  },

  async _saveFileAs() {
    try {
      const defaultName = this._currentFile ? this._fileName(this._currentFile) : 'untitled.md';
      console.log('[saveAs] invoking dialog_save_md...', defaultName);
      const path = await window.__TAURI__.core.invoke('dialog_save_md', { defaultName });
      console.log('[saveAs] result:', path);
      if (path) {
        this._currentFile = path;
        await this._saveFile();
      }
    } catch (err) {
      console.error('[saveAs] error:', err);
      alert('另存为失败: ' + JSON.stringify(err));
    }
  },

  async _exportPdf() {
    const content = Editor.getValue();
    if (!content.trim()) {
      alert('当前没有内容可导出');
      return;
    }
    try {
      const defaultName = this._currentFile
        ? this._fileName(this._currentFile).replace(/\.(md|markdown)$/i, '.pdf')
        : 'export.pdf';
      const path = await window.__TAURI__.core.invoke('dialog_save_pdf', { defaultName });
      if (path) {
        const html = Preview.getFullHtml(content);
        await window.__TAURI__.core.invoke('export_pdf', { html, outputPath: path });
        document.getElementById('status-file').textContent = `已导出: ${this._fileName(path)}`;
      }
    } catch (err) {
      console.error('Export PDF failed:', err);
      alert('导出 PDF 失败: ' + err);
    }
  },

  async _exportHtml() {
    const content = Editor.getValue();
    if (!content.trim()) {
      alert('当前没有内容可导出');
      return;
    }
    try {
      const defaultName = this._currentFile
        ? this._fileName(this._currentFile).replace(/\.(md|markdown)$/i, '.html')
        : 'export.html';
      const path = await window.__TAURI__.core.invoke('dialog_save_html', { defaultName });
      if (path) {
        const html = Preview.getFullHtml(content);
        await window.__TAURI__.core.invoke('write_md_file', { path, content: html });
        document.getElementById('status-file').textContent = `已导出: ${this._fileName(path)}`;
      }
    } catch (err) {
      console.error('Export HTML failed:', err);
    }
  },

  // ---- View ----

  _toggleReadingMode(enabled) {
    this._isReadingMode = enabled;
    const editorPanel = document.getElementById('editor-panel');
    const previewPanel = document.getElementById('preview-panel');
    const mdToolbar = document.getElementById('md-toolbar');

    if (enabled) {
      // Save editor scroll ratio before hiding
      const ta = Editor.textarea;
      const editorScrollMax = ta.scrollHeight - ta.clientHeight;
      const scrollRatio = editorScrollMax > 0 ? ta.scrollTop / editorScrollMax : 0;

      editorPanel.classList.add('hidden');
      previewPanel.classList.remove('hidden');
      mdToolbar.classList.add('hidden');
      Preview.render(Editor.getValue());

      // Restore scroll position in preview-panel (the scrollable container)
      requestAnimationFrame(() => {
        const previewScrollMax = previewPanel.scrollHeight - previewPanel.clientHeight;
        previewPanel.scrollTop = Math.round(scrollRatio * previewScrollMax);
      });
    } else {
      // Save preview scroll ratio before hiding (read while still visible)
      const previewScrollMax = previewPanel.scrollHeight - previewPanel.clientHeight;
      const scrollRatio = previewScrollMax > 0 ? previewPanel.scrollTop / previewScrollMax : 0;

      editorPanel.classList.remove('hidden');
      previewPanel.classList.add('hidden');
      mdToolbar.classList.remove('hidden');

      // Restore scroll position in editor textarea
      const ta = Editor.textarea;
      requestAnimationFrame(() => {
        const editorScrollMax = ta.scrollHeight - ta.clientHeight;
        ta.scrollTop = Math.round(scrollRatio * editorScrollMax);
        Editor._syncScroll();
      });
    }
  },

  _toggleSidebar() {
    this._sidebarVisible = !this._sidebarVisible;
    const sidebar = document.getElementById('sidebar');
    const handle = document.getElementById('resize-handle');
    if (this._sidebarVisible) {
      sidebar.classList.remove('hidden');
      handle.classList.remove('hidden');
    } else {
      sidebar.classList.add('hidden');
      handle.classList.add('hidden');
    }
  },

  // ---- Search ----
  //
  // Architecture:
  //   _findMatches()     – scans text for matches, stores positions, shows count
  //   _doSearch(dir)     – moves _searchIndex forward/backward
  //   _navigateToMatch() – renders highlight + scrolls (mode-specific rendering)
  //
  // Edit mode  → searches raw markdown, highlights via textarea selection
  // Reading mode → searches preview textContent, highlights via <mark> tags
  // Match-finding and navigation logic is shared; only rendering differs.

  _searchIndex: -1,
  _searchMatches: [],    // edit mode: char offsets; reading mode: {node, start, length}

  _openSearch() {
    const bar = document.getElementById('search-bar');
    const input = document.getElementById('search-input');
    bar.classList.remove('hidden');
    input.focus();
    input.select();
  },

  _closeSearch() {
    document.getElementById('search-bar').classList.add('hidden');
    document.getElementById('search-input').value = '';
    document.getElementById('search-count').textContent = '';
    this._searchMatches = [];
    this._searchIndex = -1;
    if (this._isReadingMode) {
      Preview.render(Editor.getValue());
    }
    Editor.focus();
  },

  // Scan for matches based on current mode, show count (does NOT move index)
  _findMatches() {
    const query = document.getElementById('search-input').value;
    const countEl = document.getElementById('search-count');
    this._searchIndex = -1;

    if (!query) {
      countEl.textContent = '';
      this._searchMatches = [];
      if (this._isReadingMode) Preview.render(Editor.getValue());
      return;
    }

    const lowerQuery = query.toLowerCase();

    if (this._isReadingMode) {
      // Search within rendered preview DOM text nodes
      Preview.render(Editor.getValue());
      const preview = document.getElementById('preview-content');
      const walker = document.createTreeWalker(preview, NodeFilter.SHOW_TEXT);
      this._searchMatches = [];
      let node;
      while ((node = walker.nextNode())) {
        const lowerText = node.textContent.toLowerCase();
        let idx = 0;
        while ((idx = lowerText.indexOf(lowerQuery, idx)) !== -1) {
          this._searchMatches.push({ node, start: idx, length: query.length });
          idx += 1;
        }
      }
    } else {
      // Search within raw markdown text
      const text = Editor.getValue();
      const lowerText = text.toLowerCase();
      this._searchMatches = [];
      let pos = 0;
      while (true) {
        const idx = lowerText.indexOf(lowerQuery, pos);
        if (idx === -1) break;
        this._searchMatches.push(idx);
        pos = idx + 1;
      }
    }

    countEl.textContent = this._searchMatches.length === 0
      ? '无结果'
      : `${this._searchMatches.length} 个匹配`;
  },

  // Move index in given direction and update count display
  _doSearch(direction) {
    if (this._searchMatches.length === 0) return;

    if (direction === 'next') {
      this._searchIndex++;
      if (this._searchIndex >= this._searchMatches.length) this._searchIndex = 0;
    } else {
      this._searchIndex--;
      if (this._searchIndex < 0) this._searchIndex = this._searchMatches.length - 1;
    }

    document.getElementById('search-count').textContent =
      `${this._searchIndex + 1} / ${this._searchMatches.length}`;
  },

  // Render highlight and scroll to current match (mode-specific rendering)
  _navigateToMatch() {
    if (this._searchMatches.length === 0 || this._searchIndex < 0) return;
    const query = document.getElementById('search-input').value;

    if (this._isReadingMode) {
      // Re-render to clear old <mark> tags, then re-find nodes
      // (needed because previous highlights altered the DOM)
      Preview.render(Editor.getValue());
      const preview = document.getElementById('preview-content');
      const lowerQuery = query.toLowerCase();
      const walker = document.createTreeWalker(preview, NodeFilter.SHOW_TEXT);
      const matches = [];
      let node;
      while ((node = walker.nextNode())) {
        const lowerText = node.textContent.toLowerCase();
        let idx = 0;
        while ((idx = lowerText.indexOf(lowerQuery, idx)) !== -1) {
          matches.push({ node, start: idx, length: query.length });
          idx += 1;
        }
      }

      if (matches.length === 0) return;
      const currentIdx = this._searchIndex % matches.length;

      // Wrap matches in <mark> tags (reverse order to preserve offsets)
      for (let i = matches.length - 1; i >= 0; i--) {
        const { node: textNode, start, length } = matches[i];
        const range = document.createRange();
        range.setStart(textNode, start);
        range.setEnd(textNode, start + length);
        const mark = document.createElement('mark');
        mark.className = i === currentIdx ? 'search-current' : 'search-highlight';
        range.surroundContents(mark);
      }

      const currentMark = preview.querySelector('.search-current');
      if (currentMark) {
        currentMark.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    } else {
      // Edit mode: select in textarea and scroll
      const matchPos = this._searchMatches[this._searchIndex];
      const ta = Editor.textarea;
      const textBefore = ta.value.substring(0, matchPos);
      const lineNum = textBefore.split('\n').length - 1;
      const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 22.4;
      ta.scrollTop = Math.max(0, lineNum * lineHeight - ta.clientHeight / 3);
      Editor._syncScroll();
      ta.focus();
      ta.setSelectionRange(matchPos, matchPos + query.length);
    }
  },

  _initSearch() {
    const input = document.getElementById('search-input');
    const closeBtn = document.getElementById('search-close');
    const prevBtn = document.getElementById('search-prev');
    const nextBtn = document.getElementById('search-next');

    // Typing: find matches and show count only
    input.addEventListener('input', () => {
      this._findMatches();
    });

    // Enter: navigate to next match
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._doSearch('next');
        this._navigateToMatch();
      } else if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        this._doSearch('prev');
        this._navigateToMatch();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this._closeSearch();
      }
    });

    closeBtn.addEventListener('click', () => this._closeSearch());
    prevBtn.addEventListener('click', () => { this._doSearch('prev'); this._navigateToMatch(); });
    nextBtn.addEventListener('click', () => { this._doSearch('next'); this._navigateToMatch(); });
  },

  // ---- Helpers ----

  _updateTitle() {
    const titleEl = document.getElementById('title-text');
    const dirty = Editor.isDirty() ? ' ●' : '';
    const name = this._currentFile ? this._fileName(this._currentFile) : '未命名';
    titleEl.textContent = `${name}${dirty} - ylin`;
  },

  _fileName(path) {
    return path.replace(/\\/g, '/').split('/').pop();
  },

  async _confirmDiscard() {
    return confirm('当前文件有未保存的修改，是否放弃更改？');
  },

  _bindMenuActions() {
    document.querySelectorAll('.menu-action').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        switch (action) {
          case 'new-file':    this._newFile(); break;
          case 'open-file':   this._openFile(); break;
          case 'open-folder': this._openFolder(); break;
          case 'save':        this._saveFile(); break;
          case 'save-as':     this._saveFileAs(); break;
          case 'close-folder':
            FileTree.closeFolder();
            break;
          case 'export-pdf':  this._exportPdf(); break;
          case 'export-html': this._exportHtml(); break;
          case 'toggle-tree':    this._toggleSidebar(); break;
          case 'toggle-preview':
            const toggle = document.getElementById('reading-mode-toggle');
            toggle.checked = !toggle.checked;
            this._toggleReadingMode(toggle.checked);
            break;
          case 'about':
            alert('ylin v1.0.0\n\n轻量级 Markdown 编辑器\n基于 Tauri 2 + Rust 构建\nhttps://github.com/Fuswn/ylin');
            break;
        }
      });
    });
  },

  _bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      const ctrl = e.ctrlKey || e.metaKey;

      // Ctrl+F: open search bar (always works)
      if (ctrl && e.key === 'f') {
        e.preventDefault();
        this._openSearch();
        return;
      }

      // Skip other shortcuts when search input is focused
      if (e.target.id === 'search-input') return;

      // F3 / Shift+F3: navigate search matches from editor
      if (e.key === 'F3' && !document.getElementById('search-bar').classList.contains('hidden')) {
        e.preventDefault();
        if (e.shiftKey) {
          this._doSearch('prev');
        } else {
          this._doSearch('next');
        }
        this._navigateToMatch();
        return;
      }

      // Escape: close search bar from editor
      if (e.key === 'Escape' && !document.getElementById('search-bar').classList.contains('hidden')) {
        e.preventDefault();
        this._closeSearch();
        return;
      }

      if (ctrl && e.key === 'n') {
        e.preventDefault();
        this._newFile();
      } else if (ctrl && e.key === 'o' && !e.shiftKey) {
        e.preventDefault();
        this._openFile();
      } else if (ctrl && e.shiftKey && e.key === 'O') {
        e.preventDefault();
        this._openFolder();
      } else if (ctrl && e.key === 's' && !e.shiftKey) {
        e.preventDefault();
        this._saveFile();
      } else if (ctrl && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        this._saveFileAs();
      } else if (ctrl && e.key === 'b' && !e.target.closest('#editor')) {
        e.preventDefault();
        this._toggleSidebar();
      } else if (ctrl && e.key === 'p') {
        e.preventDefault();
        const toggle = document.getElementById('reading-mode-toggle');
        toggle.checked = !toggle.checked;
        this._toggleReadingMode(toggle.checked);
      }

      // Editor-specific shortcuts (only when editor is focused)
      if (e.target.id === 'editor' && ctrl) {
        if (e.key === 'b') {
          e.preventDefault();
          Editor.wrapSelection('**', '**');
        } else if (e.key === 'i') {
          e.preventDefault();
          Editor.wrapSelection('*', '*');
        } else if (e.key === 'k') {
          e.preventDefault();
          Editor.insertAtCursor('[', '](https://)', '链接文本');
        }
      }
    });
  },

  _initResizeHandle() {
    const handle = document.getElementById('resize-handle');
    const sidebar = document.getElementById('sidebar');
    let isResizing = false;

    handle.addEventListener('mousedown', (e) => {
      isResizing = true;
      handle.classList.add('active');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      const newWidth = Math.max(160, Math.min(500, e.clientX));
      sidebar.style.width = newWidth + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        handle.classList.remove('active');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });
  },

  _initDragDrop() {
    const overlay = document.getElementById('drag-overlay');

    // Use Tauri 2 webviewWindow.onDragDropEvent API
    const webviewWindow = window.__TAURI__?.webviewWindow;
    if (webviewWindow) {
      const appWindow = webviewWindow.getCurrentWebviewWindow();
      appWindow.onDragDropEvent((event) => {
        const type = event.payload.type;
        console.log('[DragDrop] event type:', type, JSON.stringify(event.payload));

        if (type === 'enter' || type === 'over') {
          overlay.classList.remove('hidden');
        } else if (type === 'leave' || type === 'cancel') {
          overlay.classList.add('hidden');
        } else if (type === 'drop') {
          overlay.classList.add('hidden');
          const paths = event.payload.paths;
          if (paths && paths.length > 0) {
            const filePath = paths[0];
            if (filePath.match(/\.(md|markdown)$/i)) {
              this._loadFile(filePath);
            }
          }
        }
      });
      console.log('[DragDrop] onDragDropEvent listener registered');
      return;
    }

    // Fallback: try event.listen with various event names
    const tauriEvent = window.__TAURI__?.event;
    if (!tauriEvent) {
      console.warn('[DragDrop] No drag-drop API available');
      return;
    }

    tauriEvent.listen('tauri://drag-enter', () => {
      overlay.classList.remove('hidden');
    });
    tauriEvent.listen('tauri://drag-over', () => {
      overlay.classList.remove('hidden');
    });
    tauriEvent.listen('tauri://drag-leave', () => {
      overlay.classList.add('hidden');
    });
    tauriEvent.listen('tauri://drag-drop', (event) => {
      overlay.classList.add('hidden');
      const paths = event.payload?.paths;
      if (paths && paths.length > 0) {
        const filePath = paths[0];
        if (filePath.match(/\.(md|markdown)$/i)) {
          this._loadFile(filePath);
        }
      }
    });

    console.log('[DragDrop] Fallback drag-drop listeners registered');
  },
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
