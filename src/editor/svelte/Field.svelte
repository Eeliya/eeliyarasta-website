<!--
  One text field: a label (name, changed dot and, when `file` is given, the file the value
  is stored in) wrapping an input, or a textarea for longer text.
  type 'image': a photo (its media/ path or R2 key) with a thumbnail and an Upload button;
  a photo dropped on the field uploads too (source.js upload(): the dev server resizes it and
  stores the sizes in Cloudflare R2). The key it gets is stored like a typed value: one undo
  step.
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
    if (type === 'image') return raw.trim();
    return raw; // 'block': line breaks are kept
  }
</script>

<script>
  import { upload } from '../source.js';
  import { media, thumbUrl } from './media.svelte.js';
  import { toast } from './toasts.svelte.js';

  // edit: the field's data-edit ("file#/pointer"), also on the label so others can find it.
  // type: 'text' | 'words' | 'number' | 'block' | 'image'. onvalue(value) gets every valid input.
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

  // ---- image: upload (picked or dropped), thumbnail
  const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,image/gif,image/tiff';
  let progress = $state(null); // 0..1 while uploading, 1: the server is resizing
  let dropping = $state(false);
  let local = $state(null); // { key, url }: the uploaded file itself
  let failed = $state(''); // a thumbnail URL that did not load
  // the smallest size; the uploaded file itself when that doesn't load (no Photos address yet)
  const remote = $derived(type === 'image' && value ? thumbUrl(value) : '');
  const thumb = $derived(failed === remote && local?.key === value ? local.url : remote);

  async function send(file) {
    if (!file || progress !== null) return;
    progress = 0;
    try {
      const { key, photo } = await upload(file, (p) => (progress = p));
      media.photos[key] = photo; // its sizes, for the thumbnail and the preview
      if (local) URL.revokeObjectURL(local.url);
      local = { key, url: URL.createObjectURL(file) };
      onvalue(key);
      toast(`Uploaded ${file.name}`, { kind: 'ok', note: key });
    } catch (err) {
      toast(err.message, { kind: 'error', timeout: 0 });
    } finally {
      progress = null;
    }
  }

  function pick() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPT;
    input.onchange = () => send(input.files[0]);
    input.click();
  }

  const drop = {
    ondragover(e) {
      if (![...e.dataTransfer.types].includes('Files')) return;
      e.preventDefault();
      dropping = true;
    },
    ondragleave: () => (dropping = false),
    ondrop(e) {
      e.preventDefault();
      dropping = false;
      send(e.dataTransfer.files[0]);
    },
  };

  function oninput(e) {
    const next = parseValue(type, e.currentTarget.value);
    invalid = next === undefined;
    if (!invalid) onvalue(next);
  }
</script>

<label
  class={['tf', changed && 'is-changed', selected && 'is-selected', dropping && 'is-drop']}
  data-edit={edit}
  {...type === 'image' ? drop : {}}
>
  <span class="tf__label">
    {label}<i class="dot" title="Changed"></i>
    {#if progress !== null}
      <span class="tf__file">
        {progress < 1 ? `Uploading ${Math.round(progress * 100)}%` : 'Resizing…'}
      </span>
    {:else if file}
      <!-- folder included: pages/people.json and sources/people.json are different files -->
      <span class="tf__file" title="content/{file}">{file}</span>
    {/if}
  </span>
  {#if type === 'image'}
    <span class="tf__photo">
      {#if thumb && failed !== thumb}
        <img class="tf__thumb" src={thumb} alt="" onerror={() => (failed = thumb)} />
      {/if}
      <input
        class={['tf__input', invalid && 'is-invalid']}
        spellcheck="false"
        placeholder={placeholder || 'Drop a photo, or a media/ path'}
        {@attach show(value)}
        {onfocus}
        {oninput}
      />
      <button
        type="button"
        class="tf__upload"
        title="Upload a photo (or drop one on the field)"
        aria-label="Upload a photo for {label}"
        disabled={progress !== null}
        onclick={pick}
      >
        <i
          class={['fa-solid', progress === null ? 'fa-upload' : 'fa-spinner fa-spin']}
          aria-hidden="true"
        ></i>
      </button>
    </span>
  {:else if type === 'block'}
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

<style lang="scss">
  // a photo: thumbnail | path or key | Upload, all 36px tall like the input
  .tf__photo {
    display: flex;
    align-items: center;
    gap: 8px;
    border-radius: 8px;

    .tf__input {
      flex: 1;
      min-width: 0;
    }
  }

  .tf__thumb {
    flex: none;
    width: 36px;
    height: 36px;
    object-fit: cover;
    border-radius: 8px;
    background: rgb(255 255 255 / 0.06);
  }

  .tf__upload {
    flex: none;
    width: 36px;
    height: 36px;
    padding: 0;
    border: 0;
    border-radius: 8px;
    background: rgb(0 0 0 / 0.35);
    box-shadow: inset 0 0 0 1px var(--line);
    color: var(--muted);
    font-size: 12px;
    cursor: pointer;

    &:hover:not(:disabled) {
      color: var(--fg);
    }

    &:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 1px var(--ed-accent);
    }

    &:disabled {
      cursor: progress;
    }
  }

  // a photo dragged over the field
  .is-drop .tf__photo {
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--ed-accent) 24%, transparent);
  }
</style>
