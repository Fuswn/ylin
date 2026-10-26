/**
 * file-tree.js - Lazy-loading file tree sidebar
 * Only loads one directory level at a time; expands on click.
 * @author Fusw
 */
const FileTree = {
  container: null,
  driveList: null,
  folderNameEl: null,
  _currentRoot: '',
  _selectedPath: '',
  _onFileSelect: null,

  // Lucide-style 16px icons
  _icons: {
    folder: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" fill-opacity="0.18" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>',
    folderOpen: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/></svg>',
    file: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>',
    drive: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="12" x2="2" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" y1="16" x2="6.01" y2="16"/><line x1="10" y1="16" x2="10.01" y2="16"/></svg>',
    chevron: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>',
  },

  init() {
    this.container = document.getElementById('file-tree');
    this.driveList = document.getElementById('drive-list');
    this.folderNameEl = document.getElementById('folder-name');

    document.getElementById('btn-go-up').addEventListener('click', () => this._goUp());
    document.getElementById('btn-switch-drive').addEventListener('click', () => this._toggleDriveList());

    // Restore last folder
    const lastFolder = localStorage.getItem('md-editor-last-folder');
    if (lastFolder) {
      this.setRoot(lastFolder);
    }
  },

  onFileSelect(callback) {
    this._onFileSelect = callback;
  },

  async setRoot(path) {
    if (!path) return;
    this._currentRoot = path;

    const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
    this.folderNameEl.textContent = parts[parts.length - 1] || path;
    localStorage.setItem('md-editor-last-folder', path);
    this.driveList.classList.add('hidden');

    // Load only the top level
    this.container.innerHTML = '';
    await this._loadChildren(path, this.container, 0);
  },

  getRootPath() {
    return this._currentRoot;
  },

  // Highlight the open file (pass null to clear); nodes rendered later pick it up too
  markSelected(path) {
    this._selectedPath = path;
    this.container.querySelectorAll('.tree-item[data-path]').forEach(el => {
      el.classList.toggle('selected', el.dataset.path === path);
    });
  },

  closeFolder() {
    this._currentRoot = '';
    this.container.innerHTML = '';
    this.folderNameEl.textContent = '未打开文件夹';
    localStorage.removeItem('md-editor-last-folder');
  },

  // ---- Core: load one level and render ----

  async _loadChildren(dirPath, parentEl, level) {
    try {
      const nodes = await window.__TAURI__.core.invoke('read_dir_tree', { path: dirPath });
      this._renderNodes(nodes, parentEl, level);
    } catch (err) {
      console.error('Failed to load directory:', err);
      parentEl.innerHTML = `<div style="padding:8px 12px;color:var(--fg-dim);font-size:12px;">无法加载</div>`;
    }
  },

  _renderNodes(nodes, parentEl, level) {
    // Clear any placeholder content (e.g. "加载中...")
    parentEl.innerHTML = '';

    if (nodes.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = `padding:4px ${8 + level * 16}px;color:var(--fg-dim);font-size:12px;font-style:italic;`;
      empty.textContent = '(空)';
      parentEl.appendChild(empty);
      return;
    }

    nodes.forEach(node => {
      const item = document.createElement('div');
      item.className = 'tree-item';
      item.style.paddingLeft = `${8 + level * 16}px`;

      if (node.is_dir) {
        // ---- Directory (lazy loaded) ----
        item.innerHTML = `
          <span class="tree-toggle">${this._icons.chevron}</span>
          <span class="icon folder">${this._icons.folder}</span>
          <span class="name">${this._esc(node.name)}</span>
        `;

        const childContainer = document.createElement('div');
        childContainer.className = 'tree-children collapsed';
        let loaded = false;

        item.addEventListener('click', async (e) => {
          e.stopPropagation();
          const toggle = item.querySelector('.tree-toggle');
          const icon = item.querySelector('.icon');
          const isCollapsed = childContainer.classList.contains('collapsed');

          if (isCollapsed) {
            // Expand
            toggle.classList.add('expanded');
            childContainer.classList.remove('collapsed');
            icon.innerHTML = this._icons.folderOpen;
            if (!loaded) {
              loaded = true;
              childContainer.innerHTML = '<div style="padding:4px 24px;color:var(--fg-dim);font-size:12px;">加载中...</div>';
              await this._loadChildren(node.path, childContainer, level + 1);
            }
          } else {
            // Collapse
            toggle.classList.remove('expanded');
            childContainer.classList.add('collapsed');
            icon.innerHTML = this._icons.folder;
          }
        });

        parentEl.appendChild(item);
        parentEl.appendChild(childContainer);

      } else {
        // ---- File ----
        item.innerHTML = `
          <span class="tree-toggle leaf"></span>
          <span class="icon">${this._icons.file}</span>
          <span class="name">${this._esc(node.name)}</span>
        `;
        item.dataset.path = node.path;
        if (node.path === this._selectedPath) item.classList.add('selected');

        // Selection is updated via markSelected() once the file has actually loaded
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this._onFileSelect) {
            this._onFileSelect(node.path);
          }
        });

        parentEl.appendChild(item);
      }
    });
  },

  // ---- Navigation ----

  async _goUp() {
    if (!this._currentRoot) return;
    try {
      const parent = await window.__TAURI__.core.invoke('get_parent_dir', { path: this._currentRoot });
      if (parent && parent !== this._currentRoot) {
        this.setRoot(parent);
      }
    } catch (err) {
      console.error('Failed to go up:', err);
    }
  },

  async _toggleDriveList() {
    if (!this.driveList.classList.contains('hidden')) {
      this.driveList.classList.add('hidden');
      return;
    }
    try {
      const drives = await window.__TAURI__.core.invoke('get_drives');
      this.driveList.innerHTML = '';
      drives.forEach(drive => {
        const div = document.createElement('div');
        div.className = 'drive-item';
        div.innerHTML = `<span class="icon">${this._icons.drive}</span><span>${this._esc(drive)}</span>`;
        div.addEventListener('click', () => this.setRoot(drive));
        this.driveList.appendChild(div);
      });
      this.driveList.classList.remove('hidden');
    } catch (err) {
      console.error('Failed to get drives:', err);
    }
  },

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  },
};
