/**
 * editor.js - Editor module with line numbers, syntax highlighting & keyboard shortcuts
 */
const Editor = {
  textarea: null,
  lineNumbers: null,
  _dirty: false,
  _debounceTimer: null,
  _onChangeCallback: null,
  _undoStack: [],
  _redoStack: [],

  init() {
    this.textarea = document.getElementById('editor');
    this.lineNumbers = document.getElementById('line-numbers');

    // Sync line numbers on input / scroll
    this.textarea.addEventListener('input', () => this._onInput());
    this.textarea.addEventListener('scroll', () => this._syncScroll());
    this.textarea.addEventListener('keydown', (e) => this._onKeyDown(e));
    this.textarea.addEventListener('mouseup', () => this._updateStatus());
    this.textarea.addEventListener('keyup', () => this._updateStatus());

    // Initial render
    this._updateLineNumbers();
    this._updateStatus();
  },

  getValue() {
    return this.textarea.value;
  },

  setValue(text, markClean = false) {
    this.textarea.value = text;
    this._updateLineNumbers();
    this._updateStatus();
    if (markClean) {
      this._dirty = false;
    }
    this._fireChange();
  },

  isDirty() {
    return this._dirty;
  },

  markClean() {
    this._dirty = false;
  },

  onChange(callback) {
    this._onChangeCallback = callback;
  },

  focus() {
    this.textarea.focus();
  },

  // ---- Insert / wrap text helpers ----
  insertAtCursor(before, after = '', placeholder = '') {
    const ta = this.textarea;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = ta.value.substring(start, end);
    const text = selected || placeholder;
    const replacement = before + text + after;

    ta.focus();
    // Use execCommand for undo support in browsers
    document.execCommand('insertText', false, replacement);

    // Select the placeholder/text
    if (!selected && placeholder) {
      ta.selectionStart = start + before.length;
      ta.selectionEnd = start + before.length + placeholder.length;
    }

    this._onInput();
  },

  wrapSelection(prefix, suffix) {
    const ta = this.textarea;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = ta.value.substring(start, end);

    if (selected.startsWith(prefix) && selected.endsWith(suffix)) {
      // Unwrap
      const unwrapped = selected.slice(prefix.length, -suffix.length || undefined);
      ta.focus();
      document.execCommand('insertText', false, unwrapped);
    } else {
      ta.focus();
      document.execCommand('insertText', false, prefix + selected + suffix);
      if (!selected) {
        ta.selectionStart = start + prefix.length;
        ta.selectionEnd = start + prefix.length;
      }
    }
    this._onInput();
  },

  toggleLinePrefix(prefix) {
    const ta = this.textarea;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const value = ta.value;

    // Find current line start
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = value.indexOf('\n', end);
    const actualEnd = lineEnd === -1 ? value.length : lineEnd;
    const line = value.substring(lineStart, actualEnd);

    ta.selectionStart = lineStart;
    ta.selectionEnd = actualEnd;
    ta.focus();

    if (line.startsWith(prefix)) {
      document.execCommand('insertText', false, line.slice(prefix.length));
    } else {
      // Remove other heading prefixes if setting a heading
      let cleaned = line;
      if (prefix.startsWith('#')) {
        cleaned = line.replace(/^#{1,6}\s*/, '');
      }
      document.execCommand('insertText', false, prefix + cleaned);
    }
    this._onInput();
  },

  insertNewLine(text) {
    const ta = this.textarea;
    const pos = ta.selectionStart;
    const value = ta.value;
    const before = value.substring(0, pos);
    const needsNewline = before.length > 0 && !before.endsWith('\n');

    ta.focus();
    document.execCommand('insertText', false, (needsNewline ? '\n' : '') + text);
    this._onInput();
  },

  // ---- Private methods ----
  _onInput() {
    this._dirty = true;
    this._updateLineNumbers();
    this._updateStatus();

    // Debounced change callback (300ms)
    clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => this._fireChange(), 300);
  },

  _fireChange() {
    if (this._onChangeCallback) {
      this._onChangeCallback(this.textarea.value);
    }
  },

  _onKeyDown(e) {
    // Tab → insert 4 spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand('insertText', false, '    ');
      this._onInput();
      return;
    }

    // Ctrl+Z / Ctrl+Y handled natively by textarea
  },

  _updateLineNumbers() {
    const lines = this.textarea.value.split('\n');
    const count = lines.length;
    let html = '';
    for (let i = 1; i <= count; i++) {
      html += `<div>${i}</div>`;
    }
    this.lineNumbers.innerHTML = html;
    this._syncScroll();
  },

  _syncScroll() {
    this.lineNumbers.scrollTop = this.textarea.scrollTop;
  },

  _updateStatus() {
    const value = this.textarea.value;
    const lines = value.split('\n').length;
    const chars = value.length;
    document.getElementById('status-lines').textContent = `行: ${lines}`;
    document.getElementById('status-chars').textContent = `字符: ${chars}`;
  },
};
