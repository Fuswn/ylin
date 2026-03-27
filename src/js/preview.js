/**
 * preview.js - Markdown preview renderer
 */
const Preview = {
  container: null,
  _md: null,

  init() {
    this.container = document.getElementById('preview-content');

    // Check if markdown-it is loaded
    if (typeof window.markdownit === 'undefined') {
      console.error('[Preview] markdown-it is NOT loaded!');
      return;
    }

    // Check if hljs is loaded
    const hljsAvailable = typeof window.hljs !== 'undefined';
    console.log('[Preview] hljs available:', hljsAvailable);

    // Initialize markdown-it with highlight.js integration
    this._md = window.markdownit({
      html: false,
      linkify: true,
      typographer: true,
      highlight: function(str, lang) {
        if (hljsAvailable && lang && hljs.getLanguage(lang)) {
          try {
            return '<pre class="hljs"><code>' +
                   hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
                   '</code></pre>';
          } catch (_) {}
        }
        // Fallback: escape HTML and wrap in pre/code
        const escaped = str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return '<pre class="hljs"><code>' + escaped + '</code></pre>';
      }
    });

    console.log('[Preview] markdown-it initialized successfully');
  },

  render(markdownText) {
    if (!this._md) {
      console.warn('[Preview] markdown-it not initialized, cannot render');
      if (this.container) {
        this.container.innerHTML = '<p style="color:red;">预览引擎未加载，请检查 lib/markdown-it.min.js</p>';
      }
      return;
    }
    const html = this._md.render(markdownText || '');
    this.container.innerHTML = html;
  },

  getHtml(markdownText) {
    if (!this._md) return '';
    return this._md.render(markdownText || '');
  },

  /**
   * Get full standalone HTML for export
   */
  getFullHtml(markdownText) {
    const body = this.getHtml(markdownText);
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Markdown Export</title>
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
    max-width: 860px;
    margin: 0 auto;
    padding: 40px 20px;
    line-height: 1.7;
    color: #333;
    background: #fff;
  }
  h1, h2 { border-bottom: 1px solid #e0e0e0; padding-bottom: 0.3em; }
  h1 { font-size: 2em; }
  h2 { font-size: 1.5em; }
  h3 { font-size: 1.25em; }
  code {
    background: #f5f5f5;
    padding: 0.15em 0.4em;
    border-radius: 3px;
    font-family: Consolas, monospace;
    font-size: 0.9em;
  }
  pre {
    background: #f5f5f5;
    padding: 16px;
    border-radius: 8px;
    overflow-x: auto;
  }
  pre code { background: transparent; padding: 0; }
  blockquote {
    border-left: 4px solid #0078d4;
    padding: 8px 16px;
    margin: 1em 0;
    background: rgba(0,120,212,0.05);
    color: #666;
  }
  table { width: 100%; border-collapse: collapse; margin: 1em 0; }
  th, td { padding: 8px 12px; border: 1px solid #e0e0e0; text-align: left; }
  th { background: #f5f5f5; font-weight: 600; }
  hr { border: none; height: 1px; background: #e0e0e0; margin: 1.5em 0; }
  img { max-width: 100%; }
  a { color: #0366d6; text-decoration: none; }
</style>
</head>
<body>${body}</body>
</html>`;
  },
};
