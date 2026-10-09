/**
 * Editor UI state. main.js changes it, the Svelte shell (App.svelte) shows it: it is a
 * $state object, so a change re-renders whatever uses that field.
 */
export const ui = $state({
  /** Why the content could not be loaded; App shows it instead of the editor. */
  loadError: '',
  /** 'browse' | 'text' (the Content tab) | 'motion' */
  mode: 'browse',
  /** The edit tab Ctrl+E goes back to. */
  lastEdit: 'text',
  /** 'desktop' | 'mobile' preview size */
  viewport: 'desktop',
  saving: false,
  publishing: false,
  /** Last /__editor/status: saved files not published yet ({ files, ahead, branch, ... }). */
  pub: null,
  /** Footer status line, e.g. "Saved 2 files · 12:40:03". */
  status: '',
  /** Page menu items: every page, then the Menu and Footer components. */
  pages: [],
  /** What the Content tab edits: a page { kind: 'page', path, title } or a component. */
  target: { kind: 'page', path: '/', title: 'Home' },
  /** Bumped when the preview shows a (new) page: the Content tab re-reads its texts. */
  previewVersion: 0,
  /**
   * The text picked in the preview or in a field: { edit } (its data-edit), or null.
   * A new object on every pick, so picking the same text again scrolls to it again.
   */
  selection: null,
  /**
   * The animated element picked in the Motion tab: { el, id, key, scope }, or null.
   * scope: where its edits go: 'element' | 'target' (see motion.js).
   */
  anim: null,
  /** Home sections (indexes) the preview can only show after Save (see sections.js). */
  staleSections: [],
  /** Open/closed per Section key ("text:hero", "settings:site", ...), once toggled. */
  sections: {},
  /** The Source Explorer: open or not, its file ('' = the list of files) and item index. */
  explorer: { open: false, file: '', index: 0 },
  /** Motion tab: the Animations sub-tab (open) or Elements, and its animation ('' = the list). */
  library: { open: false, name: '' },
});
