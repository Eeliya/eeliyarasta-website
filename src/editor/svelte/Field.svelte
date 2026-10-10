<!--
  One field: a label (name, changed dot and, for a value from a source list, a button naming
  its file, e.g. people.json, that opens it in the Source Explorer) with an input, or a
  textarea for longer text, a switch (boolean) or a Select (select, options [[value, label]]).
  help: a hint under it; half: it shares a row with the next field (the parent's grid).
  type 'image': a photo (its media/ path or R2 key) as a thumbnail with its file name and
  sizes; the thumbnail or Change opens the Media window on it (MediaModal.svelte), which
  stores the photo picked there in this field: one undo step. No text input.
  Used by the Content panel, the Sources modal and Settings.
  Bindings (a block's field, src/site/layout/bindings.js):
    binds     the item's fields this one can show, [{ value, label }] (null: it can't bind).
              A Source switch in the label row: on stores { "bind": "<first>" } and shows a
              Select of them; off stores `resolved` (what it showed) as the field's own text
    names     the item's fields for {{name}} in the text: typing {{ lists them under the
              input (↑ ↓ Enter / Tab, Esc), styled like a Select's list
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
  import Button from './Button.svelte';
  import Select from './Select.svelte';
  import { baseName } from '../../site/files.js';
  import { fallback, openMedia, photoInfo, photoLine, thumbUrl } from './media.svelte.js';

  // edit: the field's data-edit ("file#/pointer"), also on the label so others can find it.
  // type: 'text' | 'words' | 'number' | 'date' | 'block' | 'image' | 'boolean' | 'select'.
  // onvalue(value) gets every valid input.
  // source: the content/sources/ file the value comes from ('' for the page's own), with
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
    names = null,
    resolved = '',
  } = $props();

  const uid = $props.id();
  let invalid = $state(false);
  const photo = $derived(type === 'image');
  // a label element around an input, a switch; photos and Selects label their own buttons
  const tag = $derived(photo || type === 'select' || bound ? 'div' : 'label');

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

  // ---- bindings
  const bound = $derived(!!value && typeof value === 'object' && typeof value.bind === 'string');
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

  // ---- {{name}} suggestions while typing
  let suggest = $state(null); // { query, start, end, active }
  let input = $state();
  const matches = $derived(
    suggest && names
      ? names.filter((n) => n.key.toLowerCase().startsWith(suggest.query.toLowerCase()))
      : [],
  );
  /** An open {{ before the caret: the list of names starting with what follows it. */
  function findSuggest(el) {
    if (!names?.length || el.selectionStart !== el.selectionEnd) return (suggest = null);
    const before = el.value.slice(0, el.selectionStart);
    const m = /\{\{\s*([\w-]*)$/.exec(before);
    if (!m) return (suggest = null);
    suggest = { query: m[1], start: m.index, end: el.selectionStart, active: 0 };
  }
  function pickName(n) {
    const el = input;
    const after = el.value.slice(suggest.end).replace(/^[\w-]*\s*(\}\})?/, '');
    const text = `${el.value.slice(0, suggest.start)}{{${n.key}}}`;
    el.value = text + after;
    el.setSelectionRange(text.length, text.length);
    suggest = null;
    oninput({ currentTarget: el });
  }
  function onkeydown(e) {
    if (!suggest || !matches.length) return;
    const n = matches.length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      suggest.active = (suggest.active + (e.key === 'ArrowDown' ? 1 : n - 1)) % n;
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      pickName(matches[Math.min(suggest.active, n - 1)]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      suggest = null;
    }
  }
  /** The list in the top layer, under the input. */
  const placeList = (el) => {
    el.showPopover?.();
    const r = input.getBoundingClientRect();
    el.style.left = `${r.left}px`;
    el.style.top = `${r.bottom}px`;
    el.style.width = `${r.width}px`;
  };
  const typed = (e) => {
    oninput(e);
    findSuggest(e.currentTarget);
  };

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
  <span class="tf__label">
    {label}<i class="dot" title="Changed"></i>
    {#if type === 'boolean'}
      <input
        type="checkbox"
        class="switch"
        checked={!!value}
        {onfocus}
        onchange={(e) => onvalue(e.currentTarget.checked)}
      />
    {/if}
    {#if binds}
      <span class="tf__bind" class:is-on={bound}>Source</span>
      <input
        type="checkbox"
        role="switch"
        class="switch"
        aria-label="{label}: from the item"
        title={!binds.length && !bound
          ? 'No item to show: pick one (Item) first'
          : bound
            ? 'Shows a field of the item (off: own text)'
            : 'Own text (on: a field of the item)'}
        disabled={!binds.length && !bound}
        checked={bound}
        {onfocus}
        onchange={(e) => setBound(e.currentTarget.checked)}
      />
    {/if}
    {#if source}
      <Button size="small" title="Edit in the Source Explorer: content/{source}" onclick={onsource}>
        {baseName(source)}
      </Button>
    {/if}
  </span>
  {#if bound}
    <Select
      id={uid}
      aria-label="{label}: item field"
      value={value.bind}
      placeholder="Pick a field…"
      options={bindOptions}
      onchange={(v) => onvalue({ bind: v })}
    />
  {:else if photo}
    <div class="photo">
      <button
        type="button"
        class="photo__thumb"
        aria-label={value ? `Change ${label}: ${photoInfo(value).name}` : `Choose ${label}`}
        onclick={change}
      >
        {#if value}
          <img src={thumbUrl(value)} alt="" {@attach fallback(value)} />
        {:else}
          <i class="fa-solid fa-plus" aria-hidden="true"></i>
        {/if}
      </button>
      <span class="photo__info">
        <span class="photo__name" title={value}>{value ? photoInfo(value).name : 'No photo'}</span>
        <span class="photo__meta">{value ? photoLine(value) : 'Choose one in Media'}</span>
      </span>
      <Button size="small" onclick={change}>{value ? 'Change' : 'Choose'}</Button>
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
      bind:this={input}
      {@attach show(value)}
      {onfocus}
      {onkeydown}
      onblur={() => (suggest = null)}
      onclick={(e) => findSuggest(e.currentTarget)}
      oninput={typed}></textarea>
  {:else}
    <input
      id={uid}
      class={['tf__input', invalid && 'is-invalid']}
      type={type === 'number' || type === 'date' ? type : 'text'}
      spellcheck={type !== 'number'}
      {placeholder}
      bind:this={input}
      {@attach show(value)}
      {onfocus}
      {onkeydown}
      onblur={() => (suggest = null)}
      onclick={(e) => findSuggest(e.currentTarget)}
      oninput={typed}
    />
  {/if}
  {#if suggest && matches.length}
    <!-- the input keeps the focus and the keys; a press on the list doesn't take it -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <ul
      class="sug"
      role="listbox"
      aria-label="Item fields"
      popover="manual"
      {@attach placeList}
      onpointerdown={(e) => e.preventDefault()}
    >
      {#each matches as n, i (n.key)}
        <li
          role="option"
          aria-selected={i === suggest.active}
          class={['sug__opt', i === suggest.active && 'is-active']}
          onpointermove={() => (suggest.active = i)}
          onclick={() => pickName(n)}
        >
          {`{{${n.key}}}`}<span class="sug__hint">{n.label}</span>
        </li>
      {/each}
    </ul>
  {/if}
  {#if help}<span class="tf__help">{help}</span>{/if}
</svelte:element>

<style lang="scss">
  // the Source switch's word, before it in the label row
  .tf__bind {
    margin-left: auto;
    color: var(--faint);

    &.is-on {
      color: var(--fg);
    }

    + :global(.switch) {
      margin-left: 0;
    }
  }

  // {{name}} suggestions: a Select's list (Select.svelte), under the input
  .sug {
    position: fixed;
    inset: auto;
    margin: 0;
    padding: 8px;
    border: 0;
    list-style: none;
    max-height: 240px;
    overflow: auto;
    color: var(--fg);
    background: var(--bg-2);
    box-shadow: inset 0 0 0 1px rgb(159 211 255 / 0.45);
    border-radius: 0 0 8px 8px;
    font: 400 12px/16px var(--f-mono);
  }

  .sug__opt {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 8px 12px;
    border-radius: 8px;
    cursor: pointer;

    &.is-active {
      background: color-mix(in srgb, var(--ed-accent) 12%, var(--bg-2));
      box-shadow: inset 0 0 0 1px var(--ed-accent);
    }
  }

  .sug__hint {
    margin-left: auto;
    color: var(--muted);
  }

  // a photo: 64px thumbnail (or a + tile), its file name and sizes, Change
  .photo {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .photo__thumb {
    flex: none;
    display: grid;
    place-items: center;
    width: 64px;
    height: 64px;
    padding: 0;
    border: 0;
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    color: var(--muted);
    background: var(--btn);
    box-shadow: inset 0 0 0 1px var(--line);
    font-size: 16px;
    transition: background 0.2s;

    &:hover {
      color: var(--fg);
      background: var(--btn-hover);
    }

    &:hover img {
      filter: brightness(1.15);
    }

    &:focus-visible,
    .is-selected & {
      outline: none;
      box-shadow:
        inset 0 0 0 1px var(--ed-accent),
        0 0 0 3px color-mix(in srgb, var(--ed-accent) 12%, transparent);
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .photo__info {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 4px;
    font-size: 12px;
    line-height: 16px;
  }

  .photo__name {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: var(--fg);
  }

  .photo__meta {
    font-size: 11px;
    color: var(--muted);
  }
</style>
