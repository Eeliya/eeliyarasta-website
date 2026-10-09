/**
 * Content panel: every [data-edit] value on the current page (or Menu / Footer
 * component), grouped by section. Section groups on the home page can be turned
 * on/off; that writes enabled flags into content JSON and hides the section in
 * the preview. Curtain *text* lives here; curtain *timing* lives in Motion.
 */
import { h, clear } from './dom.js';
import { parse } from '../lib/pointer.js';
import { SITE, HOME, sourceIdOf, baseName } from '../../site/files.js';

/** Lists in content/sources/ (people, places, projects, ...). */
const isSource = (file) => sourceIdOf(file) !== null;

/** Human label for a pointer, e.g. sources/people.json#/0/name -> "Noor Vermeer / name". */
export function labelFor(store, { file, ptr }) {
  const parts = parse(ptr);
  if (isSource(file) && /^\d+$/.test(parts[0])) {
    const item = store.current[file]?.[parts[0]];
    const name = item?.name || item?.title || `#${Number(parts[0]) + 1}`;
    return [name, ...parts.slice(1)].join(' / ');
  }
  return parts.map((p) => (/^\d+$/.test(p) ? `#${Number(p) + 1}` : p)).join(' / ');
}

const TITLE_CASE = (s) =>
  String(s || '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

/** Home sections (pages/home.json "sections", an ordered list). */
const homeSections = (store) => {
  const list = store.current[HOME]?.sections;
  return Array.isArray(list) ? list : [];
};

/** Panel group for home section `i`: id "s<i>", titled by its label, with its on/off toggle. */
function sectionGroup(store, i) {
  const section = homeSections(store)[i];
  return {
    id: `s${i}`,
    index: i,
    title: section?.label || TITLE_CASE(section?.type || `Section ${i + 1}`),
    toggle: { file: HOME, ptr: `/sections/${i}/config/enabled` },
  };
}

/**
 * Which collapsible group a field belongs to.
 * Returns { id, title, toggle? } where toggle is the enabled flag pointer if any.
 */
function groupFor(store, { file, ptr }, page) {
  const parts = parse(ptr);
  if (file === HOME) {
    if (parts[0] === 'hero')
      return { id: 'hero', title: 'Hero', toggle: { file: HOME, ptr: '/hero/enabled' } };
    if (parts[0] === 'sections' && /^\d+$/.test(parts[1] || ''))
      return sectionGroup(store, Number(parts[1]));
    if (parts[0] === 'curtain') return { id: 'transition', title: 'Page transition' };
  }
  if (file === SITE) {
    if (parts[0] === 'nav') return { id: 'nav', title: 'Navigation labels' };
    if (parts[0] === 'footer') return { id: 'footer', title: 'Footer' };
    if (parts[0] === 'social') return { id: 'social', title: 'Social links' };
    if (parts[0] === 'about') return { id: 'about', title: 'About' };
    if (parts[0] === 'pages') return { id: 'page-head', title: 'Page heading' };
    if (parts[0] === 'email' || parts[0] === 'location') return { id: 'footer', title: 'Footer' };
  }
  if (isSource(file) && /^\d+$/.test(parts[0])) {
    if (page === 'home') {
      // List items shown on a page belong to their source file, not to the section showing
      // them: one (closed) group per list, after the page's own sections.
      const id = sourceIdOf(file);
      return { id: `source:${id}`, title: `${id}.json` };
    }
    const item = store.current[file]?.[parts[0]];
    const name = item?.name || item?.title || `#${Number(parts[0]) + 1}`;
    return { id: `${file}-${parts[0]}`, title: name };
  }
  if (page === 'home') return { id: 'other', title: 'Other' };
  return { id: 'content', title: 'Content' };
}

/** Known Menu / Footer fields (shown even if the preview hasn't painted them yet). */
function componentFields(id) {
  if (id === 'menu') {
    return [
      'home',
      'photography',
      'people',
      'places',
      'projects',
      'about',
      'allPhotography',
      'allProjects',
      'menu',
      'close',
    ].map((key) => ({
      edit: `${SITE}#/nav/${key}`,
      file: SITE,
      ptr: `/nav/${key}`,
      type: 'text',
    }));
  }
  if (id === 'footer') {
    const fields = [
      { ptr: '/footer/label', type: 'text', label: 'CTA label' },
      { ptr: '/footer/cta', type: 'block', label: 'CTA text' },
      { ptr: '/footer/columns/social/title', type: 'text' },
      { ptr: '/footer/columns/index/title', type: 'text' },
      { ptr: '/footer/columns/contact/title', type: 'text' },
      { ptr: '/footer/columns/time/title', type: 'text' },
      { ptr: '/email', type: 'text' },
      { ptr: '/location', type: 'text' },
    ];
    // Index link labels
    for (let i = 0; i < 5; i++) {
      fields.push({ ptr: `/footer/columns/index/links/${i}/label`, type: 'text' });
    }
    for (let i = 0; i < 3; i++) {
      fields.push({ ptr: `/social/${i}/label`, type: 'text' });
      fields.push({ ptr: `/social/${i}/handle`, type: 'text' });
    }
    return fields
      .filter((f) => true)
      .map((f) => ({ edit: `${SITE}#${f.ptr}`, file: SITE, ptr: f.ptr, type: f.type }));
  }
  return [];
}

/** Home groups with an on/off toggle (hero + every section), even without text fields. */
const homeToggles = (store) => [
  { id: 'hero', title: 'Hero', toggle: { file: HOME, ptr: '/hero/enabled' } },
  ...homeSections(store).map((_, i) => sectionGroup(store, i)),
];

export function createTextPanel({ store, bridge, root, getTarget, getStaleSections }) {
  let inputs = new Map();
  /** @type {string | null} */
  let selectedEdit = null;
  let openGroups = new Set([
    'hero',
    'transition',
    'nav',
    'footer',
    'page-head',
    'about',
    'content',
    'sources',
  ]);
  /** Open source modal: { file, el, list, detail, index, confirm } or null. */
  let modal = null;

  function parseValue(type, raw) {
    if (type === 'number') {
      const n = Number(raw);
      return raw.trim() !== '' && Number.isFinite(n) ? n : undefined;
    }
    if (type === 'words') return raw.replace(/\s+/g, ' ').trim() || undefined;
    if (type === 'text') return raw.replace(/\s*\n\s*/g, ' ');
    return raw;
  }

  function field({ edit, file, ptr, type }) {
    // Skip enabled flags themselves — they have a dedicated toggle.
    if (ptr.endsWith('/enabled')) return null;
    const value = store.get(file, ptr);
    if (value === undefined && !edit.startsWith(`${SITE}#/nav/`)) {
      // Still show nav keys that exist; skip missing optional footer slots.
      if (file === SITE && /\/links\/\d+\//.test(ptr) && value === undefined) return null;
      if (file === SITE && /\/social\/\d+\//.test(ptr) && value === undefined) return null;
    }
    if (value === undefined && file === SITE && ptr.startsWith('/nav/')) {
      // show empty nav field only if key exists on base or current
    }
    const exists = store.get(file, ptr) !== undefined || store.getBase(file, ptr) !== undefined;
    if (!exists && (ptr.includes('/links/') || ptr.includes('/social/'))) return null;

    const changed = JSON.stringify(value) !== JSON.stringify(store.getBase(file, ptr));
    const short = labelFor(store, { file, ptr }).split(' / ').pop();
    const common = {
      class: 'tf__input',
      spellcheck: type !== 'number',
      onfocus: () => bridge.focusEdit?.(edit),
      oninput: (e) => {
        const v = parseValue(type, e.target.value);
        e.target.classList.toggle('is-invalid', v === undefined);
        if (v !== undefined) store.set(file, ptr, v, { key: `text:${edit}`, source: 'panel' });
      },
    };
    const input =
      type === 'block'
        ? h('textarea', {
            ...common,
            rows: Math.min(8, Math.max(2, Math.ceil(String(value ?? '').length / 42))),
            value: value ?? '',
          })
        : h('input', {
            ...common,
            type: type === 'number' ? 'number' : 'text',
            value: value ?? '',
          });
    inputs.set(edit, input);
    return h(
      'div',
      { class: ['tf', changed && 'is-changed'], dataset: { edit } },
      h(
        'label',
        { class: 'tf__label' },
        short,
        h('i', { class: 'dot', title: 'Changed' }),
        h('span', { class: 'tf__file', title: `content/${file}` }, baseName(file)),
      ),
      input,
    );
  }

  function syncCurtainAttr(value) {
    const view = bridge.doc?.querySelector('[data-router-view]');
    if (view) view.setAttribute('data-curtain', value ?? '');
  }

  function curtainField() {
    const view = bridge.doc?.querySelector('[data-router-view]');
    const edit = view?.getAttribute('data-curtain-edit');
    if (!edit) return null;
    const { file, ptr } = splitEdit(edit);
    const labelValue = store.get(file, ptr);
    const labelChanged = JSON.stringify(labelValue) !== JSON.stringify(store.getBase(file, ptr));
    const labelInput = h('input', {
      class: 'tf__input',
      type: 'text',
      spellcheck: true,
      value: labelValue ?? '',
      placeholder: 'Leave empty to hide the label',
      oninput: (e) => {
        const v = e.target.value;
        store.set(file, ptr, v, { key: `text:${edit}`, source: 'panel' });
        syncCurtainAttr(v);
      },
    });
    inputs.set(edit, labelInput);
    return h(
      'div',
      { class: ['tf', labelChanged && 'is-changed'], dataset: { edit } },
      h(
        'label',
        { class: 'tf__label' },
        'Curtain text',
        h('i', { class: 'dot', title: 'Changed' }),
        h('span', { class: 'tf__file', title: `content/${file}` }, baseName(file)),
      ),
      labelInput,
    );
  }

  function applySectionVisibility(id, enabled) {
    const doc = bridge.doc;
    if (!doc) return;
    doc.querySelectorAll(`[data-section="${CSS.escape(id)}"]`).forEach((el) => {
      el.hidden = enabled === false;
    });
  }

  function sectionToggle(group) {
    if (!group.toggle) return null;
    const { file, ptr } = group.toggle;
    const raw = store.get(file, ptr);
    const on = raw !== false;
    const changed =
      JSON.stringify(raw ?? true) !== JSON.stringify(store.getBase(file, ptr) ?? true);
    const input = h('input', {
      type: 'checkbox',
      class: 'sec__check',
      checked: on,
      'aria-label': `${group.title} visible`,
      onchange: (e) => {
        const enabled = e.target.checked;
        store.set(file, ptr, enabled, { key: `section:${group.id}`, source: 'panel' });
        // Home sections are synced by the editor (src/editor/sections.js); the hero is not a list item.
        if (group.index === undefined) applySectionVisibility(group.id, enabled);
      },
    });
    return h(
      'label',
      {
        class: ['sec__toggle', changed && 'is-changed'],
        title: on ? 'Section is visible' : 'Section is hidden on the public page',
      },
      input,
      h('span', { class: 'sec__switch', 'aria-hidden': 'true' }),
      h('span', { class: 'sec__state' }, on ? 'On' : 'Off'),
    );
  }

  /** Home section groups start open; afterwards they keep whatever the user chose. */
  const seenSections = new Set();

  /** Swap home section `i` with its neighbour (dir -1 = up, 1 = down): one undo step. */
  function moveSection(i, dir) {
    const list = homeSections(store);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    // Open/closed state follows the section, not the position.
    const openI = openGroups.has(`s${i}`);
    const openJ = openGroups.has(`s${j}`);
    openGroups[openJ ? 'add' : 'delete'](`s${i}`);
    openGroups[openI ? 'add' : 'delete'](`s${j}`);
    store.set(HOME, '/sections', next, { source: 'panel' });
    render();
    const btn = root.querySelector(
      `.sec[data-section="s${j}"] .sec__move[data-dir="${dir < 0 ? 'up' : 'down'}"]`,
    );
    (btn && !btn.disabled
      ? btn
      : root.querySelector(`.sec[data-section="s${j}"] .sec__head`)
    )?.focus();
  }

  function moveButtons(group) {
    const last = homeSections(store).length - 1;
    const btn = (dir, icon, label, disabled) =>
      h(
        'button',
        {
          type: 'button',
          class: 'sec__move',
          title: label,
          'aria-label': `${label}: ${group.title}`,
          disabled,
          dataset: { dir: dir < 0 ? 'up' : 'down' },
          onclick: () => moveSection(group.index, dir),
        },
        h('i', { class: ['fa-solid', icon], 'aria-hidden': 'true' }),
      );
    return h(
      'span',
      { class: 'sec__moves' },
      btn(-1, 'fa-arrow-up', 'Move up', group.index === 0),
      btn(1, 'fa-arrow-down', 'Move down', group.index === last),
    );
  }

  /** Fields of one source item shown in the modal: its top-level text and number values. */
  const SKIP_KEYS = new Set(['slug', 'cover', 'image']);
  const BLOCK_KEYS = new Set(['summary', 'description', 'note']);
  function itemFields(file, item, i) {
    return Object.entries(item || {})
      .filter(([k, v]) => !SKIP_KEYS.has(k) && (typeof v === 'string' || typeof v === 'number'))
      .map(([k, v]) => {
        const ptr = `/${i}/${k.replace(/~/g, '~0').replace(/\//g, '~1')}`;
        const type =
          typeof v === 'number'
            ? 'number'
            : BLOCK_KEYS.has(k) || String(v).length > 60
              ? 'block'
              : 'text';
        return { edit: `${file}#${ptr}`, file, ptr, type };
      });
  }

  function editSourceButton(file, { compact = false } = {}) {
    return h(
      'button',
      {
        type: 'button',
        class: ['src-edit', compact && 'src-edit--compact'],
        title: `Edit ${baseName(file)}`,
        'aria-label': `Edit ${baseName(file)}`,
        onclick: (e) => {
          e.stopPropagation();
          openSource(file);
        },
      },
      h('i', { class: 'fa-solid fa-pen-to-square', 'aria-hidden': 'true' }),
      compact ? null : ' Edit',
    );
  }

  /** Sources section (end of the panel): every list in content/sources/ with an Edit button. */
  function sourcesBlock() {
    const files = Object.keys(store.current).filter(isSource).sort();
    if (!files.length) return null;
    const rows = files.map((file) => {
      const list = store.current[file];
      const dirty = JSON.stringify(list) !== JSON.stringify(store.base[file]);
      return h(
        'div',
        { class: ['src-row', dirty && 'is-changed'] },
        h('span', { class: 'src-row__name' }, baseName(file)),
        h('i', { class: 'dot', title: 'Changed' }),
        h(
          'span',
          { class: 'src-row__count' },
          Array.isArray(list) ? `${list.length} item${list.length === 1 ? '' : 's'}` : 'not a list',
        ),
        Array.isArray(list) ? editSourceButton(file) : null,
      );
    });
    return sectionBlock({ id: 'sources', title: 'Sources' }, rows);
  }

  function closeSource() {
    if (!modal) return;
    for (const [edit, input] of inputs) if (modal.el.contains(input)) inputs.delete(edit);
    modal.el.remove();
    modal = null;
  }

  const itemName = (item) => item?.name || item?.title || 'Untitled';
  const itemMeta = (item) => item?.location || item?.kind || item?.slug || '';
  const slugify = (s) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  /** An empty item shaped like the list's first item (strings "", lists [], numbers 0). */
  function blankLike(value, key) {
    if (Array.isArray(value)) return [];
    if (value && typeof value === 'object')
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, blankLike(v, k)]));
    if (typeof value === 'string') return '';
    if (typeof value === 'number') return key === 'year' ? new Date().getFullYear() : 0;
    if (typeof value === 'boolean') return false;
    return value ?? null;
  }

  function addItem() {
    const { file } = modal;
    const list = store.current[file];
    if (!Array.isArray(list)) return;
    const slugs = new Set(list.map((it) => it?.slug));
    let n = list.length + 1;
    while (slugs.has(`new-item-${n}`)) n++;
    const item = blankLike(list[0] || { slug: '', name: '' });
    delete item.curtain; // no curtain text: the transition falls back to the item's name
    item.slug = `new-item-${n}`;
    if ('title' in item && !('name' in item)) item.title = `New item ${n}`;
    else item.name = `New item ${n}`;
    modal.index = list.length;
    modal.confirm = false;
    store.set(file, '', [...list, item], { source: 'panel' });
    render();
    modal?.detail.querySelector('.tf__input:not([disabled])')?.focus();
  }

  function deleteItem() {
    const { file, index } = modal;
    const list = store.current[file];
    if (!Array.isArray(list) || !list[index]) return;
    modal.index = Math.max(0, Math.min(index, list.length - 2));
    modal.confirm = false;
    store.set(
      file,
      '',
      list.filter((_, i) => i !== index),
      { source: 'panel' },
    );
    render();
  }

  /** Slug field: the item's URL. Editable until the item is saved, then fixed. */
  function slugField(file, item, i) {
    const saved = (store.base[file] || []).some((b) => b?.slug === item.slug);
    const input = h('input', {
      class: 'tf__input',
      type: 'text',
      spellcheck: false,
      value: item.slug ?? '',
      disabled: saved,
      oninput: (e) => {
        const v = slugify(e.target.value);
        const taken = store.current[file].some((it, k) => k !== i && it?.slug === v);
        e.target.classList.toggle('is-invalid', !v || taken);
        if (v && !taken)
          store.set(file, `/${i}/slug`, v, { key: `slug:${file}#${i}`, source: 'panel' });
      },
      onblur: (e) => {
        e.target.value = store.get(file, `/${i}/slug`) ?? '';
        e.target.classList.remove('is-invalid');
      },
    });
    return h(
      'div',
      { class: 'tf' },
      h(
        'label',
        { class: 'tf__label' },
        'slug',
        h(
          'span',
          { class: 'src-detail__hint' },
          saved ? 'fixed: it is the page URL' : 'page URL, fixed after Save',
        ),
      ),
      input,
    );
  }

  /** Fill the open modal: item list on the left, the selected item's fields on the right. */
  function renderSource() {
    if (!modal) return;
    const activeEdit = [...inputs].find(([, el]) => el === document.activeElement)?.[0];
    for (const [edit, input] of inputs) if (modal.el.contains(input)) inputs.delete(edit);
    const { file } = modal;
    const list = store.current[file];
    if (!Array.isArray(list)) {
      clear(modal.list);
      clear(modal.detail, h('p', { class: 'hint' }, `${baseName(file)} is not a list.`));
      return;
    }
    modal.index = Math.max(0, Math.min(modal.index, list.length - 1));
    const base = store.base[file] || [];
    const baseBySlug = new Map(base.map((b) => [b?.slug, b]));
    const isDirty = (item) => JSON.stringify(item) !== JSON.stringify(baseBySlug.get(item?.slug));

    clear(
      modal.list,
      h(
        'div',
        { class: 'src-list__head' },
        h('span', {}, `${list.length} item${list.length === 1 ? '' : 's'}`),
        h(
          'button',
          { type: 'button', class: 'src-edit', onclick: addItem },
          h('i', { class: 'fa-solid fa-plus', 'aria-hidden': 'true' }),
          ' Add',
        ),
      ),
      h(
        'ul',
        { class: 'src-list__items' },
        list.map((item, i) =>
          h(
            'li',
            {},
            h(
              'button',
              {
                type: 'button',
                class: [
                  'src-list__item',
                  i === modal.index && 'is-selected',
                  isDirty(item) && 'is-changed',
                ],
                'aria-current': i === modal.index ? 'true' : null,
                onclick: () => {
                  modal.index = i;
                  modal.confirm = false;
                  renderSource();
                },
              },
              h('span', { class: 'src-list__num' }, String(i + 1).padStart(2, '0')),
              h(
                'span',
                { class: 'src-list__text' },
                h('span', { class: 'src-list__name' }, itemName(item)),
                h('span', { class: 'src-list__meta' }, itemMeta(item)),
              ),
              h('i', { class: 'dot', title: 'Changed' }),
            ),
          ),
        ),
      ),
      list.length !== base.length
        ? h(
            'p',
            { class: 'hint small src-list__note' },
            'Added and deleted items show in the preview after Save.',
          )
        : null,
    );

    const i = modal.index;
    const item = list[i];
    if (!item) {
      clear(modal.detail, h('p', { class: 'hint' }, 'No items yet. Add one on the left.'));
      return;
    }
    const del = modal.confirm
      ? h(
          'span',
          { class: 'src-detail__confirm' },
          `Delete ${itemName(item)}?`,
          h(
            'button',
            {
              type: 'button',
              class: 'src-edit',
              onclick: () => {
                modal.confirm = false;
                renderSource();
              },
            },
            'Cancel',
          ),
          h(
            'button',
            { type: 'button', class: 'src-edit src-edit--danger', onclick: deleteItem },
            h('i', { class: 'fa-solid fa-trash', 'aria-hidden': 'true' }),
            ' Delete',
          ),
        )
      : h(
          'button',
          {
            type: 'button',
            class: 'src-edit src-edit--danger',
            title: `Delete ${itemName(item)}`,
            onclick: () => {
              modal.confirm = true;
              renderSource();
              modal.detail.querySelector('.src-detail__confirm .src-edit')?.focus();
            },
          },
          h('i', { class: 'fa-solid fa-trash', 'aria-hidden': 'true' }),
          ' Delete',
        );
    clear(
      modal.detail,
      h(
        'div',
        { class: 'src-detail__head' },
        h('h4', { class: 'src-item__title' }, itemName(item)),
        del,
      ),
      h(
        'div',
        { class: 'src-detail__fields' },
        'slug' in item ? slugField(file, item, i) : null,
        itemFields(file, item, i)
          .map((f) => field(f))
          .filter(Boolean),
      ),
    );
    if (selectedEdit) inputs.get(selectedEdit)?.closest('.tf')?.classList.add('is-selected');
    if (activeEdit && !document.activeElement?.closest?.('.src-modal'))
      inputs.get(activeEdit)?.focus({ preventScroll: true });
  }

  /** Typing in the modal: refresh the list's names and changed dots without a re-render. */
  function updateSourceList() {
    const list = modal && store.current[modal.file];
    if (!Array.isArray(list)) return;
    const baseBySlug = new Map((store.base[modal.file] || []).map((b) => [b?.slug, b]));
    modal.list.querySelectorAll('.src-list__item').forEach((btn, i) => {
      const item = list[i];
      btn.querySelector('.src-list__name').textContent = itemName(item);
      btn.querySelector('.src-list__meta').textContent = itemMeta(item);
      btn.classList.toggle(
        'is-changed',
        JSON.stringify(item) !== JSON.stringify(baseBySlug.get(item?.slug)),
      );
    });
    const title = modal.detail.querySelector('.src-detail__head .src-item__title');
    if (title) title.textContent = itemName(list[modal.index]);
  }

  /** Open the modal for a source file (content/sources/<name>.json), optionally at an item. */
  function openSource(file, index) {
    if (modal?.file === file) {
      if (index !== undefined && index !== modal.index) {
        modal.index = index;
        modal.confirm = false;
      }
      return renderSource();
    }
    closeSource();
    const list = h('div', { class: 'src-list' });
    const detail = h('div', { class: 'src-detail' });
    const el = h(
      'div',
      { class: 'modal src-modal', onclick: (e) => e.target === el && closeSource() },
      h(
        'div',
        {
          class: 'modal__box src-modal__box',
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': baseName(file),
        },
        h(
          'header',
          { class: 'src-modal__head' },
          h('h3', { class: 'modal__title' }, baseName(file)),
          h('span', { class: 'src-modal__path' }, `content/${file}`),
          h(
            'button',
            {
              type: 'button',
              class: 'src-modal__x',
              title: 'Close (Esc)',
              'aria-label': 'Close',
              onclick: () => closeSource(),
            },
            h('i', { class: 'fa-solid fa-xmark', 'aria-hidden': 'true' }),
          ),
        ),
        h('div', { class: 'src-modal__panes' }, list, detail),
      ),
    );
    el.close = closeSource; // Esc (src/editor/main.js) closes any open .modal
    modal = { file, el, list, detail, index: index ?? 0, confirm: false };
    document.body.append(el);
    renderSource();
  }

  /** Settings of a grid section (config.source, config.layout) as two dropdowns. */
  function gridOptions(group) {
    const i = group.index;
    const section = homeSections(store)[i];
    if (section?.type !== 'grid') return null;
    const config = section.config || {};
    const source = config.source || 'people';
    const layout = config.layout === 'even' ? 'even' : 'staggered';
    const sources = Object.keys(store.current).map(sourceIdOf).filter(Boolean).sort();
    if (!sources.includes(source)) sources.unshift(source);
    const changed = (key) =>
      JSON.stringify(store.get(HOME, `/sections/${i}/config/${key}`)) !==
      JSON.stringify(store.getBase(HOME, `/sections/${i}/config/${key}`));
    // div > label (title + select, implicit association) + optional edit button beside the label
    const select = (key, label, value, options, extra = null) =>
      h(
        'div',
        { class: ['sec__opt', changed(key) && 'is-changed', extra && 'has-extra'] },
        h(
          'label',
          { class: 'sec__opt-field' },
          h('span', { class: 'tf__label' }, label, h('i', { class: 'dot', title: 'Changed' })),
          h(
            'select',
            {
              class: 'f__select',
              onchange: (e) => {
                store.set(HOME, `/sections/${i}/config/${key}`, e.target.value, {
                  source: 'panel',
                });
                render();
              },
            },
            options.map(([v, text]) => h('option', { value: v, selected: v === value }, text)),
          ),
        ),
        extra,
      );
    const missing = !Object.keys(store.current).includes(`sources/${source}.json`);
    return h(
      'div',
      { class: 'sec__opts' },
      select(
        'source',
        'Source',
        source,
        sources.map((id) => [id, `${id}.json${id === source && missing ? ' (missing)' : ''}`]),
        missing ? null : editSourceButton(`sources/${source}.json`, { compact: true }),
      ),
      select('layout', 'Layout', layout, [
        ['staggered', 'Staggered'],
        ['even', 'Even'],
      ]),
      getStaleSections?.()?.has(i)
        ? h('p', { class: 'hint small sec__note' }, 'The preview shows this grid after Save.')
        : null,
    );
  }

  function sectionBlock(group, fields) {
    if (group.index !== undefined && !seenSections.has(group.id)) {
      seenSections.add(group.id);
      openGroups.add(group.id);
    }
    const open = openGroups.has(group.id);
    const on = group.toggle ? store.get(group.toggle.file, group.toggle.ptr) !== false : true;
    const head = h(
      'button',
      {
        type: 'button',
        class: 'sec__head',
        'aria-expanded': String(open),
        onclick: () => {
          if (openGroups.has(group.id)) openGroups.delete(group.id);
          else openGroups.add(group.id);
          render();
        },
      },
      h('i', {
        class: ['fa-solid', open ? 'fa-chevron-down' : 'fa-chevron-right', 'sec__caret'],
        'aria-hidden': 'true',
      }),
      h('span', { class: 'sec__title' }, group.title),
      group.toggle ? null : h('span', { class: 'sec__count' }, String(fields.length)),
    );

    const opts = group.index !== undefined ? gridOptions(group) : null;
    const body = h(
      'div',
      { class: 'sec__body', hidden: !open },
      opts,
      fields.length || opts
        ? fields
        : h(
            'p',
            { class: 'hint small' },
            on
              ? 'No text fields in this section.'
              : 'Section is off. Turn it on to show it on the page.',
          ),
    );

    return h(
      'section',
      { class: ['sec', !on && 'is-off'], dataset: { section: group.id } },
      h(
        'div',
        { class: 'sec__bar' },
        head,
        group.index !== undefined ? moveButtons(group) : null,
        sectionToggle(group),
      ),
      body,
    );
  }

  function collectFields(target) {
    if (target?.kind === 'component') {
      return componentFields(target.id).filter((f) => {
        const v = store.get(f.file, f.ptr);
        const b = store.getBase(f.file, f.ptr);
        return v !== undefined || b !== undefined;
      });
    }
    // Page content only: header/nav and footer are edited via the Menu / Footer components.
    return (bridge.editFields?.() || []).filter((f) => {
      if (f.file !== SITE) return true;
      const top = parse(f.ptr)[0];
      return (
        top !== 'nav' &&
        top !== 'footer' &&
        top !== 'social' &&
        top !== 'email' &&
        top !== 'location'
      );
    });
  }

  function render() {
    inputs = new Map();
    const target = getTarget?.() || { kind: 'page', path: bridge.path?.() || '/' };
    if (!bridge.api && target.kind === 'page') {
      return clear(root, h('p', { class: 'hint' }, 'Waiting for the preview…'));
    }

    const page = bridge.doc?.querySelector('[data-router-view]')?.dataset?.page;
    const isHome = target.kind === 'page' && (target.path === '/' || page === 'home');

    const rawFields = collectFields(target);
    const groups = new Map(); // id -> { group, fields: [] }

    const ensure = (g) => {
      if (!groups.has(g.id)) groups.set(g.id, { group: g, fields: [] });
      return groups.get(g.id);
    };

    if (isHome) homeToggles(store).forEach((g) => ensure(g));

    for (const f of rawFields) {
      const g = groupFor(store, f, page);
      // List items on a page that isn't theirs are edited in the Sources modal.
      if (g.id.startsWith('source:')) continue;
      ensure(g).fields.push(f);
      // Prefer toggle meta from groupFor when colliding with HOME_TOGGLES
      if (g.toggle) groups.get(g.id).group = { ...groups.get(g.id).group, ...g };
    }

    if (target.kind === 'page') {
      const curtain = curtainField();
      if (curtain) {
        const g = { id: 'transition', title: 'Page transition' };
        ensure(g).fields.push({ __node: curtain });
      }
    }

    const order = isHome
      ? ['hero', ...homeSections(store).map((_, i) => `s${i}`), 'transition']
      : [...groups.keys()];
    const ordered = [
      ...order.filter((id) => groups.has(id)).map((id) => groups.get(id)),
      ...[...groups.entries()].filter(([id]) => !order.includes(id)).map(([, v]) => v),
    ];

    const hint =
      target.kind === 'component'
        ? target.id === 'menu'
          ? 'Editing Menu labels. Changes show in the header and mobile menu of the preview.'
          : 'Editing Footer copy. Scroll the preview to the bottom to see changes.'
        : 'Click any outlined text in the preview to edit it in place, or use the fields below. Turn a section Off to hide it on the public page.';

    clear(
      root,
      h('p', { class: 'hint' }, hint),
      ordered.length
        ? ordered.map(({ group, fields }) => {
            const nodes = fields.map((f) => (f.__node ? f.__node : field(f))).filter(Boolean);
            return sectionBlock(group, nodes);
          })
        : h('p', { class: 'hint' }, 'No editable content here.'),
      target.kind === 'page' ? sourcesBlock() : null,
    );
    renderSource();
    if (selectedEdit) {
      const input = inputs.get(selectedEdit);
      input?.closest('.tf')?.classList.add('is-selected');
    }
  }

  function update() {
    for (const [edit, input] of inputs) {
      const { file, ptr } = splitEdit(edit);
      const value = store.get(file, ptr);
      if (document.activeElement !== input && input.value !== String(value ?? ''))
        input.value = value ?? '';
      const changed = JSON.stringify(value) !== JSON.stringify(store.getBase(file, ptr));
      input.parentElement?.classList.toggle('is-changed', changed);
    }
    updateSourceList();
    for (const row of root.querySelectorAll('.src-row')) {
      const file = `sources/${row.querySelector('.src-row__name').textContent}`;
      row.classList.toggle(
        'is-changed',
        JSON.stringify(store.current[file]) !== JSON.stringify(store.base[file]),
      );
    }
    const view = bridge.doc?.querySelector('[data-router-view]');
    const edit = view?.getAttribute('data-curtain-edit');
    if (edit) {
      const { file, ptr } = splitEdit(edit);
      const value = store.get(file, ptr);
      if (value !== undefined && value !== null) syncCurtainAttr(value);
    }
    // Keep section visibility in sync (e.g. after undo).
    if (bridge.doc) {
      for (const g of homeToggles(store)) {
        const enabled = store.get(g.toggle.file, g.toggle.ptr) !== false;
        if (g.index === undefined) applySectionVisibility(g.id, enabled);
        const block = root.querySelector(`[data-section="${g.id}"]`);
        if (block) {
          block.classList.toggle('is-off', !enabled);
          const check = block.querySelector('.sec__check');
          if (check && document.activeElement !== check) check.checked = enabled;
          const state = block.querySelector('.sec__state');
          if (state) state.textContent = enabled ? 'On' : 'Off';
        }
      }
    }
  }

  function setSelectedField(edit) {
    selectedEdit = edit || null;
    for (const el of document.querySelectorAll('.tf.is-selected'))
      el.classList.remove('is-selected');
    if (!selectedEdit) return;
    const input = inputs.get(selectedEdit);
    input?.closest('.tf')?.classList.add('is-selected');
  }

  function focusField(edit) {
    if (edit == null) {
      setSelectedField(null);
      return;
    }
    const input = inputs.get(edit);
    if (!input) {
      const { file, ptr } = splitEdit(edit);
      const page = bridge.doc?.querySelector('[data-router-view]')?.dataset?.page;
      const g = groupFor(store, { file, ptr }, page);
      // A list item shown on another page (a person's name on home): edit it in the modal.
      if (g.id.startsWith('source:')) {
        openSource(file, Number(parse(ptr)[0]) || 0);
        const field = inputs.get(edit);
        if (!field) return;
        field.focus({ preventScroll: true });
        return focusField(edit);
      }
      // Expand the group that owns this field, then re-render and try again.
      openGroups.add(g.id);
      render();
      const again = inputs.get(edit);
      if (!again) return;
      return focusField(edit);
    }
    const row = input.closest('.tf') || input.parentElement;
    const sec = row?.closest('.sec');
    if (sec && sec.querySelector('.sec__body')?.hidden) {
      openGroups.add(sec.dataset.section);
      render();
      return focusField(edit);
    }
    row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    setSelectedField(edit);
  }
  return { render, update, focusField };
}

function splitEdit(edit) {
  const i = edit.indexOf('#');
  return { file: edit.slice(0, i), ptr: edit.slice(i + 1) };
}
