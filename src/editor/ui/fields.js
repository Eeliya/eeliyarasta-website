/**
 * Form controls for the motion panel. Each returns { el, update(value, meta) } so the
 * panel can refresh values in place (without stealing focus or breaking a drag).
 * meta = { source: 'element'|'target'|'preset'|'defaults'|null, canReset: boolean }
 */
import { h } from './dom.js';

const SOURCE_LABEL = {
  element: 'element',
  target: 'target',
  preset: 'preset',
  defaults: 'default',
};

function shell(label, control, { onReset, hint } = {}) {
  const badge = h('span', { class: 'f__src' });
  const reset = h(
    'button',
    { type: 'button', class: 'f__reset', title: 'Reset to inherited value', onclick: onReset },
    '↺',
  );
  const el = h(
    'div',
    { class: 'f' },
    h(
      'div',
      { class: 'f__top' },
      h('label', { class: 'f__label', title: hint || '' }, label),
      badge,
      reset,
    ),
    control,
  );
  return {
    el,
    meta({ source, canReset, text } = {}) {
      badge.textContent = text || (source ? SOURCE_LABEL[source] : 'unset');
      badge.dataset.src = source || (text ? 'mixed' : 'none');
      reset.hidden = !canReset;
    },
  };
}

export function numberField({
  label,
  min = 0,
  max = 1,
  step = 0.01,
  unit = '',
  hint,
  onChange,
  onReset,
}) {
  const range = h('input', { type: 'range', class: 'f__range', min, max, step });
  const num = h('input', { type: 'number', class: 'f__num', step });
  let dragging = false;
  range.addEventListener('pointerdown', () => (dragging = true));
  window.addEventListener('pointerup', () => (dragging = false));
  range.addEventListener('input', () => {
    num.value = range.value;
    onChange(Number(range.value));
  });
  num.addEventListener('input', () => {
    if (num.value === '' || !Number.isFinite(Number(num.value))) return;
    range.value = num.value;
    onChange(Number(num.value));
  });
  const s = shell(
    label,
    h('div', { class: 'f__row' }, range, num, unit ? h('span', { class: 'f__unit' }, unit) : null),
    { onReset, hint },
  );
  return {
    el: s.el,
    update(value, meta) {
      s.meta(meta);
      const v = value ?? '';
      if (!dragging && document.activeElement !== range) range.value = v;
      if (document.activeElement !== num) num.value = v;
    },
  };
}

/**
 * Duration + ease on one row. update([duration, ease], [durationMeta, easeMeta]); the badge
 * shows both sources when they differ, and reset clears both.
 */
export function pairField({
  label,
  min = 0,
  max = 4,
  step = 0.01,
  unit = 's',
  hint,
  ease,
  onNumber,
  onReset,
}) {
  const num = h('input', { type: 'number', class: 'f__num', step, min, max, title: 'Duration' });
  num.addEventListener('input', () => {
    if (num.value === '' || !Number.isFinite(Number(num.value))) return;
    onNumber(Number(num.value));
  });
  const row = h(
    'div',
    { class: 'f__pair' },
    h('span', { class: 'f__numwrap' }, num, unit ? h('span', { class: 'f__unit' }, unit) : null),
    ease.el,
  );
  const s = shell(label, row, { onReset, hint });
  return {
    el: s.el,
    update([dv, ev] = [], [dm = {}, em = {}] = []) {
      const same = dm.source === em.source;
      const name = (x) => (x ? SOURCE_LABEL[x] : 'unset');
      s.meta({
        source: same ? dm.source : null,
        canReset: !!(dm.canReset || em.canReset),
        text: same ? null : name(dm.source) + ' / ' + name(em.source),
      });
      if (document.activeElement !== num) num.value = dv ?? '';
      ease.update(ev ?? 'none');
    },
  };
}

export function textField({ label, suggestions = [], hint, onChange, onReset, placeholder = '' }) {
  const id = `dl-${Math.random().toString(36).slice(2, 8)}`;
  const input = h('input', {
    type: 'text',
    class: 'f__text',
    spellcheck: false,
    placeholder,
    list: suggestions.length ? id : null,
  });
  input.addEventListener('change', () => onChange(input.value.trim()));
  const dl = suggestions.length
    ? h(
        'datalist',
        { id },
        suggestions.map((v) => h('option', { value: v })),
      )
    : null;
  const s = shell(label, h('div', { class: 'f__row' }, input, dl), { onReset, hint });
  return {
    el: s.el,
    update(value, meta) {
      s.meta(meta);
      if (document.activeElement !== input) input.value = value ?? '';
    },
  };
}

export function segmentField({ label, options, hint, onChange, onReset }) {
  const buttons = options.map(([value, text]) =>
    h(
      'button',
      {
        type: 'button',
        class: 'seg__btn',
        dataset: { value: JSON.stringify(value) },
        onclick: () => onChange(value),
      },
      text,
    ),
  );
  const s = shell(label, h('div', { class: 'seg seg--small' }, buttons), { onReset, hint });
  return {
    el: s.el,
    update(value, meta) {
      s.meta(meta);
      const key = JSON.stringify(value ?? options[0][0]);
      buttons.forEach((b) => b.classList.toggle('is-active', b.dataset.value === key));
    },
  };
}

export function customField({ label, control, hint, onReset }) {
  const s = shell(label, control.el, { onReset, hint });
  return {
    el: s.el,
    update(value, meta) {
      s.meta(meta);
      control.update(value);
    },
  };
}
