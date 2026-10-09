<!--
  One text field: a label (name, changed dot and, when `file` is given, the file the value
  is stored in) wrapping an input, or a textarea for longer text.
  Used by the Content panel and the Sources modal.
-->
<script module>
  /** Input text -> stored value. undefined means invalid: the value is not stored. */
  export function parseValue(type, raw) {
    if (type === 'number') {
      const n = Number(raw);
      return raw.trim() !== '' && Number.isFinite(n) ? n : undefined;
    }
    if (type === 'words') return raw.replace(/\s+/g, ' ').trim() || undefined;
    if (type === 'text') return raw.replace(/\s*\n\s*/g, ' ');
    return raw; // 'block': line breaks are kept
  }
</script>

<script>
  import { baseName } from '../../site/files.js';

  // edit: the field's data-edit ("file#/pointer"), also on the label so others can find it.
  // type: 'text' | 'words' | 'number' | 'block'. onvalue(value) gets every valid input.
  let {
    edit,
    label,
    value,
    type = 'text',
    file = null,
    placeholder = '',
    changed = false,
    selected = false,
    onfocus,
    onvalue,
  } = $props();

  let invalid = $state(false);
  const rows = $derived(Math.min(8, Math.max(2, Math.ceil(String(value ?? '').length / 42))));

  /** Show the stored value, except while the user is typing in the field. */
  const show = (value) => (el) => {
    const text = String(value ?? '');
    if (document.activeElement !== el && el.value !== text) el.value = text;
  };

  function oninput(e) {
    const next = parseValue(type, e.currentTarget.value);
    invalid = next === undefined;
    if (!invalid) onvalue(next);
  }
</script>

<label class={['tf', changed && 'is-changed', selected && 'is-selected']} data-edit={edit}>
  <span class="tf__label">
    {label}<i class="dot" title="Changed"></i>
    {#if file}<span class="tf__file" title="content/{file}">{baseName(file)}</span>{/if}
  </span>
  {#if type === 'block'}
    <textarea
      class={['tf__input', invalid && 'is-invalid']}
      {rows}
      {placeholder}
      {@attach show(value)}
      {onfocus}
      {oninput}></textarea>
  {:else}
    <input
      class={['tf__input', invalid && 'is-invalid']}
      type={type === 'number' ? 'number' : 'text'}
      spellcheck={type !== 'number'}
      {placeholder}
      {@attach show(value)}
      {onfocus}
      {oninput}
    />
  {/if}
</label>
