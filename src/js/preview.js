/**
 * preview.js - Markdown preview renderer
 * @author Fusw
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
  /* Same typography as the light-theme preview */
  @page { margin: 18mm 16mm; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    max-width: 760px;
    margin: 0 auto;
    padding: 48px 24px;
    font-size: 16px;
    line-height: 1.8;
    color: #2b2f35;
    background: #fff;
    overflow-wrap: break-word;
    /* Keep code / table backgrounds in the PDF */
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  h1, h2, h3, h4, h5, h6 { margin: 1.8em 0 0.7em; font-weight: 600; line-height: 1.35; color: #14171a; }
  h1 { font-size: 2em; font-weight: 700; margin-top: 0; }
  h2 { font-size: 1.5em; padding-bottom: 0.35em; border-bottom: 1px solid rgba(0,0,0,0.08); }
  h3 { font-size: 1.25em; }
  h4 { font-size: 1.1em; }
  p { margin: 0.9em 0; }
  a { color: #1f63e6; text-decoration: underline; text-decoration-color: rgba(31,99,230,0.3); text-underline-offset: 3px; }
  strong { font-weight: 600; color: #14171a; }
  code {
    background: rgba(0,0,0,0.05);
    color: #c23a55;
    padding: 0.15em 0.4em;
    border-radius: 5px;
    font-family: "Cascadia Code", Consolas, ui-monospace, Menlo, monospace;
    font-size: 0.86em;
  }
  pre {
    margin: 1.4em 0;
    padding: 16px 20px;
    background: #f7f7f9;
    border: 1px solid rgba(0,0,0,0.06);
    border-radius: 10px;
    overflow-x: auto;
  }
  pre code { background: transparent; color: inherit; padding: 0; font-size: 13px; line-height: 1.65; }
  blockquote {
    margin: 1.4em 0;
    padding: 0.8em 1.2em;
    border-left: 3px solid #2b6cf0;
    background: rgba(43,108,240,0.06);
    border-radius: 0 8px 8px 0;
    color: #6a6f78;
  }
  blockquote > :first-child { margin-top: 0; }
  blockquote > :last-child { margin-bottom: 0; }
  ul, ol { padding-left: 1.6em; }
  li { margin: 0.35em 0; }
  table {
    width: 100%;
    margin: 1.4em 0;
    border-collapse: separate;
    border-spacing: 0;
    border: 1px solid rgba(0,0,0,0.09);
    border-radius: 10px;
    overflow: hidden;
    font-size: 0.94em;
  }
  th, td { padding: 9px 14px; text-align: left; border-bottom: 1px solid rgba(0,0,0,0.09); }
  th + th, td + td { border-left: 1px solid rgba(0,0,0,0.09); }
  tr:last-child td { border-bottom: none; }
  th { background: #f6f7f9; font-weight: 600; }
  hr { margin: 2.2em 0; border: none; height: 1px; background: rgba(0,0,0,0.09); }
  img { max-width: 100%; border-radius: 8px; }
  @media print {
    body { max-width: none; padding: 0; }
    pre, blockquote, table, img { break-inside: avoid; }
  }
</style>
</head>
<body>${body}</body>
</html>`;
  },
};
