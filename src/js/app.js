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
      editorPanel.classList.add('hidden');
      previewPanel.classList.remove('hidden');
      mdToolbar.classList.add('hidden');
      Preview.render(Editor.getValue());
    } else {
      editorPanel.classList.remove('hidden');
      previewPanel.classList.add('hidden');
      mdToolbar.classList.remove('hidden');
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
    document.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    document.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.name.match(/\.(md|markdown)$/i)) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            Editor.setValue(ev.target.result, true);
            this._currentFile = null;
            this._updateTitle();
          };
          reader.readAsText(file);
        }
      }
    });
  },
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
