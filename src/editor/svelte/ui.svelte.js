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
  /**
   * Page menu items: the site parts (Header, Footer), then every page. A [slug] template is
   * one item with `template` (its page id) and `items` ([{ path, title }], its pages).
   */
  pages: [],
  /** The path shown in the preview ("/people/noor-vermeer/"). */
  path: '/',
  /** What the Content tab edits: a page { kind: 'page', path, title } or a site part { kind: 'part', id: 'header' | 'footer', title }. */
  target: { kind: 'page', path: '/', title: 'Home' },
  /** Bumped when the preview shows a (new) page: the Content tab re-reads its texts. */
  previewVersion: 0,
  /**
   * The text picked in the preview or in a field: { edit } (its data-edit), or null.
   * A new object on every pick, so picking the same text again scrolls to it again.
   */
  selection: null,
  /**
   * The section the pointer is over, { id, from: 'panel' | 'preview' }, or null: the other
   * side shows it faintly (a section row in the Content tab, the section in the preview).
   */
  peek: null,
  /** A custom section's rows while its bottom edge is dragged in the preview: { id, rows } (overlay.js). */
  secRows: null,
  /**
   * The animated element picked in the Motion tab: { el, id, key, scope }, or null.
   * scope: where its edits go: 'element' | 'target' (see motion.js).
   */
  anim: null,
  /** Content tab: the block open in the block inspector (its id), or null, and its tab. */
  block: null,
  /** Content tab: an empty section's own view open (its id; no block to open), or null. */
  section: null,
  /** 'content' | 'layout' | 'motion' */
  blockTab: 'content',
  /** Content tab: the link selected in the preview (its follower's block id), or null. */
  link: null,
  /** Open/closed per Section key ("text:hero", "settings:site", ...), once toggled. */
  sections: {},
  /**
   * The Source Explorer: open or not, its file ('' = the list of files), item index and the
   * highlighted field (its key in source-items.js itemFields, e.g. "name", "images.1").
   */
  explorer: { open: false, file: '', index: 0, field: '' },
  /**
   * The Media window: open or not, the selected photo (media/ path or R2 key), the list filter
   * ('all' | 'r2' | 'local') and the field it picks for (its data-edit, '' = just managing).
   */
  media: { open: false, key: '', filter: 'all', pick: '' },
  /** The Pages window: open or not, and the folder it shows ('' = content/en/pages/ itself). */
  pagesWin: { open: false, folder: '' },
  /** Motion tab: the Animations sub-tab (open) or Elements, and its animation ('' = the list). */
  library: { open: false, name: '' },
});
