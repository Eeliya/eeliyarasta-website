/**
 * Text panel: every [data-edit] value on the current page as a form field.
 * Typing here or directly in the preview (contenteditable) edits the same value
 * in the in-memory content; both stay in sync.
 */
import { h, clear } from './dom.js';
import { parse } from '../lib/pointer.js';

const ARRAY_FILES = new Set(['people.json', 'places.json', 'projects.json']);

/** Human label for a pointer, e.g. people.json#/0/name -> "Noor Vermeer › name". */
export function labelFor(store, { file, ptr }) {
  const parts = parse(ptr);
  if (ARRAY_FILES.has(file) && /^\d+$/.test(parts[0])) {
    const item = store.current[file]?.[parts[0]];
    const name = item?.name || item?.title || `#${Number(parts[0]) + 1}`;
    return [name, ...parts.slice(1)].join(' › ');
  }
  return parts.map((p) => (/^\d+$/.test(p) ? `#${Number(p) + 1}` : p)).join(' › ');
}

export function createTextPanel({ store, bridge, root }) {
  let inputs = new Map(); // edit -> input

  function parseValue(type, raw) {
    if (type === 'number') {
      const n = Number(raw);
      return raw.trim() !== '' && Number.isFinite(n) ? n : undefined;
    }
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

  function render() {
    inputs = new Map();
    const fields = bridge.editFields();
    if (!bridge.api) return clear(root, h('p', { class: 'hint' }, 'Waiting for the preview…'));
    clear(root,
      h('p', { class: 'hint' }, 'Click any outlined text in the preview to edit it in place, or use the fields below. Enter finishes a single-line field; multi-line fields take Enter as a line break.'),
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
      input.parentElement.classList.toggle('is-changed', changed);
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
