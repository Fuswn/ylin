/**
 * toolbar.js - Markdown formatting toolbar actions
 * @author Fusw
 */
const Toolbar = {
  init() {
    document.querySelectorAll('#md-toolbar .tb-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        this._handleAction(action);
      });
    });
  },

  _handleAction(action) {
    switch (action) {
      case 'h1': Editor.toggleLinePrefix('# '); break;
      case 'h2': Editor.toggleLinePrefix('## '); break;
      case 'h3': Editor.toggleLinePrefix('### '); break;
      case 'h4': Editor.toggleLinePrefix('#### '); break;
      case 'h5': Editor.toggleLinePrefix('##### '); break;

      case 'bold':          Editor.wrapSelection('**', '**'); break;
      case 'italic':        Editor.wrapSelection('*', '*'); break;
      case 'strikethrough': Editor.wrapSelection('~~', '~~'); break;
      case 'inline-code':   Editor.wrapSelection('`', '`'); break;

      case 'code-block':
        Editor.insertNewLine('```\n代码\n```');
        break;
      case 'blockquote':
        Editor.toggleLinePrefix('> ');
        break;
      case 'hr':
        Editor.insertNewLine('\n---\n');
        break;

      case 'ul':
        Editor.toggleLinePrefix('- ');
        break;
      case 'ol':
        Editor.toggleLinePrefix('1. ');
        break;

      case 'link':
        Editor.insertAtCursor('[', '](https://)', '链接文本');
        break;
      case 'image':
        Editor.insertAtCursor('![', '](图片URL)', '图片描述');
        break;
      case 'table':
        Editor.insertNewLine(
          '| 标题1 | 标题2 | 标题3 |\n' +
          '| ----- | ----- | ----- |\n' +
          '| 内容1 | 内容2 | 内容3 |\n'
        );
        break;
    }
  },
};
