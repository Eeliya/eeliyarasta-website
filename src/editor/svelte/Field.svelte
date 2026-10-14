<!--
  One field: a label (name, and, changed, a dot before it;, for a value from a source list, a button naming
  its file, e.g. people.json, that opens it in the Source Explorer) with an input, or a
  textarea for longer text, a switch (boolean) or a Select (select, options [[value, label]]).
  bare: no label row (label is the input's aria-label; say it in the placeholder); help: a hint under it; half: it shares a row with the next field (the parent's grid).
  type 'image': a photo (its media/ path or R2 key) as a 64px card: the photo, its label
  (inside), file name and sizes, Media and ✕ (clears it; remove: the parent's, a list item's);
  grab: a pointerdown on the photo (a list's drag handle, PhotoList.svelte); the thumbnail or Change opens the Media window on it (MediaModal.svelte), which
  stores the photo picked there in this field: one undo step. No text input.
  Used by the Content panel, the Sources modal and Settings.
  Bindings (a block's field, src/site/layout/bindings.js):
    binds     the item's fields this one can show, [{ value, label }] (null: it can't bind).
              A Source switch in the label row, only when there is an item to show (binds
              not empty) or the field is still bound: on stores { "bind": "<first>" } and shows a
              Select of them; off stores `resolved` (what it showed) as the field's own text
    formats   a text field: when bound, a Format input under the Select ("{value} photos");
              empty or just {value} stores { "bind" } alone
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
  import { isBinding } from '../../site/layout/bindings.js';
  import { showValue } from '../lib/show-value.js';
  import Button from './Button.svelte';
  import Select from './Select.svelte';
  import { baseName } from '../../site/files.js';
  import { fallback, openMedia, photoInfo, photoLine, thumbUrl } from './media.svelte.js';

  // edit: the field's data-edit ("file#/pointer"), also on the label so others can find it.
  // type: 'text' | 'words' | 'number' | 'date' | 'block' | 'image' | 'boolean' | 'select'.
  // onvalue(value) gets every valid input.
  // source: the content/en/sources/ file the value comes from ('' for the page's own), with
  // onsource() opening it.
  let {
    edit,
    label,
    value,
    type = 'text',
    source = '',
    onsource,
    placeholder = '',
    help = '',
    half = false,
    options = [],
    changed = false,
    selected = false,
    onfocus,
    onvalue,
    binds = null,
    formats = false,
    resolved = '',
    bare = false,
    grab = null,
    remove = null,
  } = $props();

  const uid = $props.id();
  let invalid = $state(false);
  const photo = $derived(type === 'image');
  // a label element around an input, a switch; photos and Selects label their own buttons
  const tag = $derived(photo || type === 'select' || bound ? 'div' : 'label');
  // a photo's label goes inside its card, unless the label row has more (a Source switch, a file)
  const inner = $derived(photo && !bound && !(binds && binds.length) && !source);

  /** Show the stored value, except while the user is typing in the field. */
  const show = (value) => showValue(String(value ?? ''));

  function oninput(e) {
    const next = parseValue(type, e.currentTarget.value);
    invalid = next === undefined;
    if (!invalid) onvalue(next);
  }

  // ---- bindings
  const bound = $derived(isBinding(value));
  const bindOptions = $derived.by(() => {
    const list = binds || [];
    return bound && !list.some((o) => o.value === value.bind)
      ? [...list, { value: value.bind, label: `${value.bind} (missing)` }]
      : list;
  });
  function setBound(on) {
    if (on) onvalue({ bind: binds[0].value });
    else onvalue(typeof resolved === 'string' ? resolved : '');
  }

  // ---- a bound text's format: {value} is the item's value
  const fmtShow = $derived(bound && typeof value.format === 'string' ? value.format : '');
  function setFormat(raw) {
    const format = raw.replace(/\s*\n\s*/g, ' ');
    onvalue(
      format.trim() && format.trim() !== '{value}'
        ? { bind: value.bind, format }
        : { bind: value.bind },
    );
  }

  function change() {
    onfocus?.();
    openMedia({ key: value || '', pick: edit });
  }
</script>

<!-- a photo has no input to label: a div, its buttons say what they do -->
<svelte:element
  this={tag}
  for={tag === 'label' && type !== 'boolean' ? uid : undefined}
  class={['tf', changed && 'is-changed', selected && 'is-selected', half && 'is-half']}
  data-edit={edit}
>
  {#if !bare && !inner}<span class="tf__label">
      {label}
      {#if type === 'boolean'}
        <input
          type="checkbox"
          class="switch"
          checked={!!value}
          {onfocus}
          onchange={(e) => onvalue(e.currentTarget.checked)}
        />
      {/if}
      {#if binds && (binds.length || bound)}
        <span class="tf__bind" class:is-on={bound}>Source</span>
        <input
          type="checkbox"
          role="switch"
          class="switch"
          aria-label="{label}: from the item"
          title={bound
            ? 'Shows a field of the item (off: own text)'
            : 'Own text (on: a field of the item)'}
          checked={bound}
          {onfocus}
          onchange={(e) => setBound(e.currentTarget.checked)}
        />
      {/if}
      {#if source}
        <Button
          size="small"
          title="Edit in the Source Explorer: content/{source}"
          onclick={onsource}
        >
          {baseName(source)}
        </Button>
      {/if}
    </span>{/if}
  {#if bound}
    <Select
      id={uid}
      aria-label="{label}: item field"
      value={value.bind}
      placeholder="Pick a field…"
      options={bindOptions}
      onchange={(v) => onvalue(value.format ? { bind: v, format: value.format } : { bind: v })}
    />
    {#if formats}
      <input
        class="tf__input tf__format"
        aria-label="{label}: format"
        title="Text around the item's value: {'{value}'} is the value"
        placeholder={'{value}'}
        {@attach show(fmtShow)}
        {onfocus}
        oninput={(e) => setFormat(e.currentTarget.value)}
      />
    {/if}
  {:else if photo}
    <div class={['photo', !value && 'is-empty']}>
      <button
        type="button"
        class={['photo__thumb', grab && 'is-grab']}
        aria-label={value ? `Change ${label}: ${photoInfo(value).name}` : `Choose ${label}`}
        title={grab ? 'Drag to move (Alt+↑/↓), click to change' : undefined}
        aria-keyshortcuts={grab ? 'Alt+ArrowUp Alt+ArrowDown' : undefined}
        onpointerdown={grab}
        onclick={change}
      >
        {#if value}
          <img src={thumbUrl(value)} alt="" draggable="false" {@attach fallback(value)} />
        {:else}
          <i class="fa-solid fa-plus" aria-hidden="true"></i>
        {/if}
      </button>
      <span class="photo__info">
        {#if inner && !bare}<span class="photo__label">{label}</span>{/if}
        <span class="photo__name" title={value}>{value ? photoInfo(value).name : 'No photo'}</span>
        {#if value}<span class="photo__meta">{photoLine(value)}</span>{/if}
      </span>
      <Button
        icon="images"
        iconOnly
        label={value ? `Change ${label} in Media` : `Choose ${label} in Media`}
        onclick={change}
      />
      {#if remove || value}
        <Button
          icon="xmark"
          iconOnly
          label="Remove {label}"
          onclick={remove ?? (() => onvalue(''))}
        />
      {/if}
    </div>
  {:else if type === 'select'}
    <Select
      id={uid}
      aria-label={label}
      value={value ?? ''}
      placeholder="Pick…"
      options={options.map(([v, text]) => ({ value: v, label: text }))}
      onchange={(v) => onvalue(v)}
    />
  {:else if type === 'boolean'}
    <!-- the switch is in the label row -->
  {:else if type === 'block'}
    <textarea
      id={uid}
      class={['tf__input', invalid && 'is-invalid']}
      {placeholder}
      {@attach show(value)}
      {onfocus}
      {oninput}></textarea>
  {:else}
    <input
      id={uid}
      class={['tf__input', invalid && 'is-invalid']}
      type={type === 'number' || type === 'date' ? type : 'text'}
      aria-label={bare ? label : undefined}
      spellcheck={type !== 'number'}
      {placeholder}
      {@attach show(value)}
      {onfocus}
      {oninput}
    />
  {/if}
  {#if help}<span class="tf__help">{help}</span>{/if}
</svelte:element>

<style lang="scss">
  // the Source switch's word, before it in the label row
  .tf__bind {
    margin-left: auto;
    color: var(--c-text-faint);

    &.is-on {
      color: var(--c-text);
    }

    + :global(.switch) {
      margin-left: 0;
    }
  }

  .tf__format {
    margin-top: var(--space-2);
  }

  // a photo: a card as an input (its background, line, 8px corners), 64px in every state:
  // the photo its full height on the left (a + tile when empty; a list's drag handle), its
  // label, file name and sizes, then Media (change) and ✕ (remove), icon-only
  .photo {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    height: 64px;
    padding-right: var(--space-2);
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--c-input);
    box-shadow: inset 0 0 0 1px var(--c-line);
  }

  .photo__thumb {
    flex: none;
    display: grid;
    place-items: center;
    width: 64px;
    height: 64px;
    padding: 0;
    border: 0;
    border-radius: var(--radius-md) 0 0 var(--radius-md);
    overflow: hidden;
    cursor: pointer;
    color: var(--c-text-faint);
    background: var(--c-switch);
    font-size: var(--fs-lg);
    transition: background 0.2s;

    &.is-grab {
      cursor: grab;
    }

    &:hover {
      color: var(--c-text);
      background: var(--c-control-hover);
    }

    &:hover img {
      filter: brightness(1.15);
    }

    &:focus-visible,
    .is-selected & {
      outline: none;
      box-shadow: inset 0 0 0 1px var(--c-accent);
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      -webkit-user-drag: none;
    }
  }

  .photo__info {
    flex: 1;
    min-width: 0;
    display: grid;
    font-size: var(--fs-base);
    line-height: 16px;
  }

  // (changed: the dot before it, editor.scss)
  .photo__label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--fs-sm);
    color: var(--c-text-muted);
  }

  .photo__label,
  .photo__name,
  .photo__meta {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .photo__name {
    color: var(--c-text-strong);
    font-weight: 500;

    .is-empty & {
      color: var(--c-text-muted);
      font-weight: 400;
    }
  }

  .photo__meta {
    font-size: var(--fs-sm);
    color: var(--c-text-muted);
  }
</style>
