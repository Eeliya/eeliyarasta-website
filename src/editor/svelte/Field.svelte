<!--
  One field: a label (name, changed dot and, for a value from a source list, a button naming
  its file, e.g. people.json, that opens it in the Source Explorer) with an input, or a
  textarea for longer text.
  type 'image': a photo (its media/ path or R2 key) as a thumbnail with its file name and
  sizes; the thumbnail or Change opens the Media window on it (MediaModal.svelte), which
  stores the photo picked there in this field: one undo step. No text input.
  Used by the Content panel, the Sources modal and Settings.
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
  import { baseName } from '../../site/files.js';
  import { fallback, openMedia, photoInfo, photoLine, thumbUrl } from './media.svelte.js';

  // edit: the field's data-edit ("file#/pointer"), also on the label so others can find it.
  // type: 'text' | 'words' | 'number' | 'block' | 'image'. onvalue(value) gets every valid input.
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
    changed = false,
    selected = false,
    onfocus,
    onvalue,
  } = $props();

  const uid = $props.id();
  let invalid = $state(false);
  const photo = $derived(type === 'image');

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

  function change() {
    onfocus?.();
    openMedia({ key: value || '', pick: edit });
  }
</script>

<!-- a photo has no input to label: a div, its buttons say what they do -->
<svelte:element
  this={photo ? 'div' : 'label'}
  for={photo ? undefined : uid}
  class={['tf', changed && 'is-changed', selected && 'is-selected']}
  data-edit={edit}
>
  <span class="tf__label">
    {label}<i class="dot" title="Changed"></i>
    {#if source}
      <Button size="small" title="Edit in the Source Explorer: content/{source}" onclick={onsource}>
        {baseName(source)}
      </Button>
    {/if}
  </span>
  {#if photo}
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
      type={type === 'number' ? 'number' : 'text'}
      spellcheck={type !== 'number'}
      {placeholder}
      {@attach show(value)}
      {onfocus}
      {oninput}
    />
  {/if}
</svelte:element>

<style lang="scss">
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
