/**
 * file-tree.js - Lazy-loading file tree sidebar
 * Only loads one directory level at a time; expands on click.
 */
const FileTree = {
  container: null,
  driveList: null,
  folderNameEl: null,
  _currentRoot: '',
  _selectedPath: '',
  _onFileSelect: null,

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
          <span class="tree-toggle">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 6 15 12 9 18"/></svg>
          </span>
          <span class="icon">📁</span>
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
            icon.textContent = '📂';
            if (!loaded) {
              loaded = true;
              childContainer.innerHTML = '<div style="padding:4px 24px;color:var(--fg-dim);font-size:12px;">加载中...</div>';
              await this._loadChildren(node.path, childContainer, level + 1);
            }
          } else {
            // Collapse
            toggle.classList.remove('expanded');
            childContainer.classList.add('collapsed');
            icon.textContent = '📁';
          }
        });

        parentEl.appendChild(item);
        parentEl.appendChild(childContainer);

      } else {
        // ---- File ----
        item.innerHTML = `
          <span class="tree-toggle leaf">
            <svg width="10" height="10" viewBox="0 0 24 24"><polyline points="9 6 15 12 9 18"/></svg>
          </span>
          <span class="icon">📄</span>
          <span class="name">${this._esc(node.name)}</span>
        `;
        item.dataset.path = node.path;

        item.addEventListener('click', (e) => {
          e.stopPropagation();
          this.container.querySelectorAll('.tree-item.selected').forEach(el => el.classList.remove('selected'));
          item.classList.add('selected');
          this._selectedPath = node.path;
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
        div.innerHTML = `<span class="icon">💿</span><span>${drive}</span>`;
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
