/**
 * Text panel: every [data-edit] value on the current page as a form field.
 * Typing here or directly in the preview (contenteditable) edits the same value
 * in the in-memory content; both stay in sync.
 *
 * Also shows a "Page transition" section for the current page's curtain label
 * (data-curtain-edit on <main>) and the shared hold duration in animations.json.
 */
import { h, clear } from './dom.js';
import { parse } from '../lib/pointer.js';

const ARRAY_FILES = new Set(['people.json', 'places.json', 'projects.json']);
const CURTAIN_HOLD_PTR = '/transitions/page/curtain/hold';
const CURTAIN_IN_PTR = '/transitions/page/curtain/in/duration';
const CURTAIN_OUT_PTR = '/transitions/page/curtain/out/duration';

/** Human label for a pointer, e.g. people.json#/0/name -> "Noor Vermeer / name". */
export function labelFor(store, { file, ptr }) {
  const parts = parse(ptr);
  if (ARRAY_FILES.has(file) && /^\d+$/.test(parts[0])) {
    const item = store.current[file]?.[parts[0]];
    const name = item?.name || item?.title || `#${Number(parts[0]) + 1}`;
    return [name, ...parts.slice(1)].join(" / ");
  }
  return parts.map((p) => (/^\d+$/.test(p) ? `#${Number(p) + 1}` : p)).join(" / ");
}

export function createTextPanel({ store, bridge, root }) {
  let inputs = new Map(); // edit -> input

  function parseValue(type, raw) {
    if (type === 'number') {
      const n = Number(raw);
      return raw.trim() !== '' && Number.isFinite(n) ? n : undefined;
    }
    if (type === 'words') return raw.replace(/\s+/g, ' ').trim() || undefined; // hero name: never empty
    if (type === 'text') return raw.replace(/\s*\n\s*/g, ' ');
    return raw;
  }

  function field({ edit, file, ptr, type }) {
    const value = store.get(file, ptr);
    const changed = JSON.stringify(value) !== JSON.stringify(store.getBase(file, ptr));
    const common = {
      class: 'tf__input',
      spellcheck: type !== 'number',
      onfocus: () => bridge.focusEdit(edit),
      oninput: (e) => {
        const v = parseValue(type, e.target.value);
        e.target.classList.toggle('is-invalid', v === undefined);
        if (v !== undefined) store.set(file, ptr, v, { key: `text:${edit}`, source: 'panel' });
      },
    };
    const input = type === 'block'
      ? h('textarea', { ...common, rows: Math.min(8, Math.max(2, Math.ceil(String(value ?? '').length / 42))), value: value ?? '' })
      : h('input', { ...common, type: type === 'number' ? 'number' : 'text', value: value ?? '' });
    inputs.set(edit, input);
    return h('div', { class: ['tf', changed && 'is-changed'], dataset: { edit } },
      h('label', { class: 'tf__label' }, h('span', { class: 'tf__file' }, file.replace('.json', '')), labelFor(store, { file, ptr }), h('i', { class: 'dot', title: 'Changed' })),
      input,
    );
  }

  /** Sync data-curtain on the preview's <main> so the next navigation uses the draft label. */
  function syncCurtainAttr(value) {
    const view = bridge.doc?.querySelector('[data-router-view]');
    if (view) view.setAttribute('data-curtain', value ?? '');
  }

  function curtainSection() {
    const view = bridge.doc?.querySelector('[data-router-view]');
    const edit = view?.getAttribute('data-curtain-edit');
    if (!edit) return null;

    const { file, ptr } = splitEdit(edit);
    const labelValue = store.get(file, ptr);
    const holdValue = store.get('animations.json', CURTAIN_HOLD_PTR);
    const inValue = store.get('animations.json', CURTAIN_IN_PTR);
    const outValue = store.get('animations.json', CURTAIN_OUT_PTR);
    const labelChanged = JSON.stringify(labelValue) !== JSON.stringify(store.getBase(file, ptr));
    const holdChanged = JSON.stringify(holdValue) !== JSON.stringify(store.getBase('animations.json', CURTAIN_HOLD_PTR));
    const inChanged = JSON.stringify(inValue) !== JSON.stringify(store.getBase('animations.json', CURTAIN_IN_PTR));
    const outChanged = JSON.stringify(outValue) !== JSON.stringify(store.getBase('animations.json', CURTAIN_OUT_PTR));

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

    const numField = (ptrPath, value, changed, key, label) => {
      const input = h('input', {
        class: 'tf__input',
        type: 'number',
        step: '0.01',
        min: '0',
        value: value ?? '',
        oninput: (e) => {
          const n = Number(e.target.value);
          const ok = e.target.value.trim() !== '' && Number.isFinite(n) && n >= 0;
          e.target.classList.toggle('is-invalid', !ok);
          if (ok) store.set('animations.json', ptrPath, n, { key, source: 'panel' });
        },
      });
      inputs.set(`animations.json#${ptrPath}`, input);
      return h('div', { class: ['tf', changed && 'is-changed'], dataset: { edit: `animations.json#${ptrPath}` } },
        h('label', { class: 'tf__label' }, h('span', { class: 'tf__file' }, 'animations'), label, h('i', { class: 'dot', title: 'Changed' })),
        input,
      );
    };

    return h('section', { class: 'grp' },
      h('h4', { class: 'grp__title' }, 'Page transition'),
      h('p', { class: 'hint' }, 'Text shown on the curtain when you navigate to this page, and how long it stays fully visible before the curtain lifts. Clear the text to hide the label.'),
      h('div', { class: ['tf', labelChanged && 'is-changed'], dataset: { edit } },
        h('label', { class: 'tf__label' }, h('span', { class: 'tf__file' }, file.replace('.json', '')), 'Curtain text', h('i', { class: 'dot', title: 'Changed' })),
        labelInput,
      ),
      numField(CURTAIN_HOLD_PTR, holdValue, holdChanged, 'curtain:hold', 'Hold (seconds)'),
      numField(CURTAIN_IN_PTR, inValue, inChanged, 'curtain:in', 'Curtain in (seconds)'),
      numField(CURTAIN_OUT_PTR, outValue, outChanged, 'curtain:out', 'Curtain out (seconds)'),
    );
  }

  function render() {
    inputs = new Map();
    const fields = bridge.editFields();
    if (!bridge.api) return clear(root, h('p', { class: 'hint' }, 'Waiting for the preview…'));
    const transition = curtainSection();
    clear(root,
      h('p', { class: 'hint' }, 'Click any outlined text in the preview to edit it in place, or use the fields below. Enter finishes a single-line field; multi-line fields take Enter as a line break.'),
      transition,
      fields.length ? h('div', { class: 'tlist' }, fields.map(field)) : h('p', { class: 'hint' }, 'No editable text on this page.'),
    );
  }

  /** Values changed elsewhere (preview, undo): refresh inputs that are not being typed in. */
  function update() {
    for (const [edit, input] of inputs) {
      const { file, ptr } = splitEdit(edit);
      const value = store.get(file, ptr);
      if (document.activeElement !== input && input.value !== String(value ?? '')) input.value = value ?? '';
      const changed = JSON.stringify(value) !== JSON.stringify(store.getBase(file, ptr));
      input.parentElement?.classList.toggle('is-changed', changed);
    }
    // Keep data-curtain in sync with the draft label.
    const view = bridge.doc?.querySelector('[data-router-view]');
    const edit = view?.getAttribute('data-curtain-edit');
    if (edit) {
      const { file, ptr } = splitEdit(edit);
      const value = store.get(file, ptr);
      if (value !== undefined && value !== null) syncCurtainAttr(value);
    }
  }

  function focusField(edit) {
    const input = inputs.get(edit);
    if (!input) return;
    const row = input.parentElement;
    row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    row.classList.remove('is-flash');
    void row.offsetWidth;
    row.classList.add('is-flash');
  }

  return { render, update, focusField };
}

function splitEdit(edit) {
  const i = edit.indexOf('#');
  return { file: edit.slice(0, i), ptr: edit.slice(i + 1) };
}
