/**
 * themes.js - Theme management module
 */
const ThemeManager = {
  STORAGE_KEY: 'md-editor-theme',
  current: 'dark',
  hljsThemes: {
    dark:  'lib/hljs-github-dark.css',
    light: 'lib/hljs-github.css',
    sepia: 'lib/hljs-stackoverflow-light.css',
  },

  init() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved && ['dark', 'light', 'sepia'].includes(saved)) {
      this.current = saved;
    }
    this.apply(this.current);

    // Bind theme buttons
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.apply(btn.dataset.theme);
      });
    });
  },

  apply(theme) {
    this.current = theme;
    document.body.className = `theme-${theme}`;
    localStorage.setItem(this.STORAGE_KEY, theme);

    // Update active button
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });

    // Update highlight.js theme (local files)
    const hljsLink = document.getElementById('hljs-theme');
    if (hljsLink) {
      hljsLink.href = this.hljsThemes[theme] || this.hljsThemes.dark;
    }
  },
};
