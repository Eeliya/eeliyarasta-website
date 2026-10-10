<!--
  Media window: every photo the site can use, the ones uploaded to Cloudflare R2
  (content/settings/photos.json) and the ones in media/ (the media manifest). Like the
  Pages and Sources windows: the header with where it is, the photos left (a grid, filtered
  by All / R2 / Local), the selected one right: a larger preview, its sizes, where the
  content uses it (click to go there) and its alt text, which belongs to the photo.
  Upload (or drop files anywhere on the window) resizes and stores them in R2, a few at a
  time, each tile showing how far it is. Opened from a photo field (openMedia, with `pick`)
  it offers "Use this photo": the field gets the key, one undo step. Delete is only there for
  photos nothing uses. Alt text and Delete go straight to disk (source.mediaOp), like uploads.
  Where it is lives in ui.media (persist.js).
-->
<script>
  import Button from './Button.svelte';
  import { tick, flushSync } from 'svelte';
  import ExplorerHead from './ExplorerHead.svelte';
  import ExplorerRow from './ExplorerRow.svelte';
  import { ui } from './ui.svelte.js';
  import {
    media,
    fallback,
    imageUrl,
    isR2,
    photoInfo,
    photoLine,
    thumbUrl,
  } from './media.svelte.js';
  import { labelFor, splitEdit } from './content-groups.js';
  import { photoUses } from '../lib/photo-uses.js';
  import { parse } from '../lib/pointer.js';
  import { mediaOp, upload } from '../source.js';
  import { toast } from './toasts.svelte.js';
  import { SITE, pageIdOf, sourceIdOf } from '../../site/files.js';
  import { pathOfId } from '../../site/routes.js';

  // live: reactive store (live.svelte.js); bridge: the preview; actions: setMode, pickTarget
  let { live, bridge, actions } = $props();

  const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,image/gif,image/tiff';
  const FILTERS = [
    ['all', 'All'],
    ['r2', 'R2'],
    ['local', 'Local'],
  ];
  const uid = $props.id();
  let dialog = $state();
  let confirming = $state(false);
  let busy = $state(false);
  let dropping = $state(false);
  let alt = $state('');
  // uploads in progress: { id, name, url, progress } (0..1 bytes sent, 1: resizing; null: waiting)
  let pending = $state([]);

  const key = $derived(ui.media.key);
  const keys = $derived(
    [...Object.keys(media.photos).filter(isR2), ...Object.keys(media.manifest).sort()].filter(
      (k) => (ui.media.filter === 'r2' ? isR2(k) : ui.media.filter === 'local' ? !isR2(k) : true),
    ),
  );
  const known = $derived(!!key && (isR2(key) || !!media.manifest[key]));
  // where the content (with unsaved edits) uses the selected photo
  const uses = $derived.by(() => {
    live.version;
    return known ? photoUses(live.store.current, key) : [];
  });
  const pick = $derived(ui.media.pick ? splitEdit(ui.media.pick) : null);
  const current = $derived(pick ? live.get(pick.file, pick.ptr) : undefined);

  function select(next) {
    ui.media.key = next;
    confirming = false;
    alt = media.photos[next]?.alt || '';
  }

  /** Open the window (on its photo); pick: see openMedia in media.svelte.js. */
  export function open() {
    select(ui.media.key);
    flushSync();
    if (!dialog.open) dialog.showModal();
    ui.media.open = true;
    const tile = dialog.querySelector('.mtile.is-selected') || dialog.querySelector('.mtile');
    tile?.focus({ preventScroll: true });
    tile?.scrollIntoView({ block: 'nearest' });
  }

  const loaded = $derived.by(() => {
    live.version;
    return Object.keys(live.store.current).length > 0;
  });
  // openMedia() and a refresh (persist.js) set ui.media.open: open then, once loaded.
  $effect(() => {
    if (ui.media.open && loaded && !dialog.open) tick().then(open);
  });

  function close() {
    dialog.close();
  }

  // ---- upload: picked or dropped, two at a time
  function pickFiles() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPT;
    input.multiple = true;
    input.onchange = () => add([...input.files]);
    input.click();
  }

  let nextId = 0;
  function add(files) {
    const images = files.filter((f) => ACCEPT.split(',').includes(f.type));
    if (images.length < files.length)
      toast(
        `Skipped ${files.length - images.length} file(s): not a JPEG, PNG, WebP, AVIF, GIF or TIFF`,
        {
          kind: 'error',
        },
      );
    const jobs = images.map((file) => ({
      id: ++nextId,
      file,
      name: file.name,
      url: URL.createObjectURL(file),
      progress: null,
    }));
    pending = [...jobs, ...pending];
    run();
  }

  let running = 0;
  async function run() {
    while (running < 2) {
      const job = pending.find((j) => j.progress === null);
      if (!job) return;
      running++;
      send(job).finally(() => {
        running--;
        run();
      });
    }
  }

  async function send(job) {
    const set = (p) =>
      (pending = pending.map((j) => (j.id === job.id ? { ...j, progress: p } : j)));
    set(0);
    try {
      const res = await upload(job.file, set);
      media.photos[res.key] = { ...res.photo, ...media.photos[res.key] };
      media.blobs[res.key] = job.url;
      if (ui.media.filter === 'local') ui.media.filter = 'all';
      select(res.key);
      toast(res.existing ? `${job.name} is already in R2` : `Uploaded ${job.name}`, {
        kind: 'ok',
        note: res.key,
      });
    } catch (err) {
      URL.revokeObjectURL(job.url);
      toast(`${job.name}: ${err.message}`, { kind: 'error', timeout: 0 });
    } finally {
      pending = pending.filter((j) => j.id !== job.id);
    }
  }

  const drop = {
    ondragover(e) {
      if (![...e.dataTransfer.types].includes('Files')) return;
      e.preventDefault();
      dropping = true;
    },
    ondragleave(e) {
      if (e.target === dialog || !dialog.contains(e.relatedTarget)) dropping = false;
    },
    ondrop(e) {
      e.preventDefault();
      dropping = false;
      add([...e.dataTransfer.files]);
    },
  };

  // ---- the selected photo
  async function saveAlt() {
    const text = alt.replace(/\s+/g, ' ').trim();
    if (text === (media.photos[key]?.alt || '')) return;
    try {
      await mediaOp({ op: 'alt', key, alt: text });
      toast(text ? 'Alt text saved' : 'Alt text removed', { kind: 'ok', note: key });
    } catch (err) {
      toast(err.message, { kind: 'error', timeout: 0 });
    }
  }

  async function remove() {
    busy = true;
    try {
      await mediaOp({ op: 'delete', key });
      toast(`Deleted ${photoInfo(key).name}`, { kind: 'ok', note: key });
      delete media.blobs[key];
      select('');
    } catch (err) {
      toast(err.message, { kind: 'error', timeout: 0 });
    } finally {
      busy = false;
    }
  }

  async function askDelete() {
    confirming = true;
    await tick();
    dialog.querySelector('.confirm button')?.focus();
  }

  function use() {
    live.store.set(pick.file, pick.ptr, key, { source: 'panel' });
    close();
  }

  /** A use as a row: "Noor Vermeer / photo 4" in "people.json" */
  const where = (u) => ({
    name: labelFor(live.store, u).replace(
      /(?:images|photos) \/ #?(\d+) \/ src$/,
      (_, n) => `photo ${Number(n) + 1}`,
    ),
    meta: u.file,
  });

  /** Go to a use: a list item in the Source Explorer, a page's field, a setting. */
  function go(u) {
    close();
    if (u.file === SITE) return actions.setMode('settings');
    actions.setMode('text');
    const parts = parse(u.ptr);
    if (sourceIdOf(u.file)) {
      ui.explorer = {
        open: true,
        file: u.file,
        index: Number(parts[0]) || 0,
        field: parts.slice(1).join('.'),
      };
      return;
    }
    const id = pageIdOf(u.file);
    if (id === null) return;
    const path = pathOfId(id);
    const edit = `${u.file}#${u.ptr}`;
    const pickField = () => {
      const el = bridge.doc?.querySelector(`[data-edit="${CSS.escape(edit)}"]`);
      if (!el) return toast(`${where(u).name} is not shown on ${path}`, { kind: 'error' });
      bridge.focusEdit(edit);
      ui.selection = { edit }; // the Content tab opens its group and scrolls to it
    };
    if (bridge.path() === path) return pickField();
    // another page: pick the field once the preview has loaded it (and set itself up)
    const shown = ui.previewVersion;
    actions.pickTarget(ui.pages.find((p) => p.path === path) || { kind: 'page', path, title: id });
    let tries = 0;
    const wait = () => {
      if (ui.previewVersion !== shown && bridge.api && bridge.path() === path)
        setTimeout(pickField, 200);
      else if (++tries < 50) setTimeout(wait, 100);
    };
    wait();
  }
</script>

<!-- Esc closes a modal <dialog> by itself; a click on the backdrop lands on the dialog. -->
<dialog
  class={['modal__box', 'md-modal', dropping && 'is-drop']}
  aria-label="Media"
  bind:this={dialog}
  onclick={(e) => e.target === dialog && close()}
  onclose={() => (ui.media.open = false)}
  {...drop}
>
  <ExplorerHead
    title="Media"
    icon="fa-images"
    sep="/"
    crumbs={[
      { label: 'media', onclick: () => select('') },
      ...(key ? [{ label: photoInfo(key).name }] : []),
    ]}
    onclose={close}
  />

  <nav class="md-list" aria-label="Photos">
    <div class="row md-list__head">
      <div class="seg md-filter" role="group" aria-label="Show">
        {#each FILTERS as [value, label] (value)}
          <button
            type="button"
            class={['seg__btn', ui.media.filter === value && 'is-active']}
            aria-pressed={ui.media.filter === value}
            onclick={() => (ui.media.filter = value)}
          >
            {label}
          </button>
        {/each}
      </div>
      <Button
        size="small"
        icon="upload"
        title="Upload photos to R2 (or drop them here)"
        onclick={pickFiles}
      >
        Upload
      </Button>
    </div>
    <ul class="md-grid">
      {#each pending as job (job.id)}
        <li class="mtile mtile--busy">
          <img src={job.url} alt="" />
          <span class="mtile__state">
            {job.progress === null
              ? 'Waiting…'
              : job.progress < 1
                ? `Uploading ${Math.round(job.progress * 100)}%`
                : 'Resizing…'}
          </span>
        </li>
      {/each}
      {#each keys as k (k)}
        <li>
          <button
            type="button"
            class={['mtile', k === key && 'is-selected', k === current && 'is-current']}
            title="{k} · {photoLine(k)}"
            aria-label={photoInfo(k).name}
            aria-current={k === key}
            onclick={() => select(k)}
          >
            <img src={thumbUrl(k)} alt="" loading="lazy" {@attach fallback(k)} />
          </button>
        </li>
      {/each}
    </ul>
    {#if !keys.length && !pending.length}
      <p class="hint small">No photos here yet: upload some, or drop them on this window.</p>
    {/if}
  </nav>

  <section class="md-detail">
    {#if key && known}
      {@const info = photoInfo(key)}
      <header class="md-detail__head">
        <h4 class="md-detail__title">{info.name}</h4>
        {#if pick}
          <Button
            variant="primary"
            size="small"
            icon="check"
            disabled={key === current}
            onclick={use}
          >
            Use this photo
          </Button>
        {/if}
      </header>
      <img class="md-preview" src={imageUrl(key)} alt="" {@attach fallback(key)} />
      <p class="hint small">{photoLine(key)} · {key}</p>

      <label class="tf" for="{uid}-alt">
        <span class="tf__label">Alt text (what the photo shows, for screen readers)</span>
        <textarea
          id="{uid}-alt"
          class="tf__input"
          placeholder="e.g. A woman in a white shirt on a balcony"
          bind:value={alt}
          onchange={saveAlt}></textarea>
      </label>

      <div class="md-uses">
        <span class="tf__label"
          >{uses.length
            ? `Used in ${uses.length} place${uses.length === 1 ? '' : 's'}`
            : 'Not used'}</span
        >
        <ul class="list">
          {#each uses as u (`${u.file}#${u.ptr}`)}
            {@const w = where(u)}
            <li>
              <ExplorerRow
                icon="fa-file-lines"
                enter
                name={w.name}
                meta={w.meta}
                onclick={() => go(u)}
              />
            </li>
          {/each}
        </ul>
      </div>

      {#if !uses.length}
        {#if confirming}
          <div class="confirm">
            Delete {info.name}{info.storage === 'R2'
              ? ' and all its sizes from R2'
              : ' from media/'}?
            <Button size="small" onclick={() => (confirming = false)}>Cancel</Button>
            <Button variant="danger" size="small" icon="trash" disabled={busy} onclick={remove}>
              Delete
            </Button>
          </div>
        {:else}
          <div class="row">
            <Button variant="danger" size="small" icon="trash" onclick={askDelete}>Delete</Button>
          </div>
        {/if}
      {/if}
    {:else if key}
      <p class="hint">{key} is not in media/ or R2 any more.</p>
    {:else}
      <p class="hint">
        {pick
          ? 'Pick a photo on the left, or upload one, then Use this photo.'
          : 'Every photo the site can use: uploaded to R2, or in media/. Pick one to see where it is used and to edit its alt text. Drop photos on this window to upload them.'}
      </p>
    {/if}
  </section>
</dialog>

<style lang="scss">
  // like the Pages and Sources windows: header on top, the photos left, the selected one right
  dialog.md-modal {
    width: min(1040px, 92vw);
    height: min(720px, calc(100vh - 64px));
    display: grid;
    grid-template-columns: minmax(320px, 1fr) minmax(320px, 400px);
    grid-template-rows: auto minmax(0, 1fr);
    padding: 0;
    overflow: hidden;

    &:not([open]) {
      display: none;
    }

    // files dragged over the window
    &.is-drop {
      box-shadow: inset 0 0 0 2px var(--ed-accent);
    }
  }

  .md-list {
    overflow: auto;
    padding: 16px 16px 24px;
    border-right: 1px solid var(--line);
  }

  .md-list__head {
    justify-content: space-between;
    padding: 0 0 12px;
  }

  .md-filter {
    width: 192px;
  }

  .md-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: 8px;
  }

  .mtile {
    position: relative;
    display: block;
    width: 100%;
    aspect-ratio: 1;
    padding: 0;
    border: 0;
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    background: var(--btn);
    box-shadow: inset 0 0 0 1px var(--line);

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: filter 0.2s;
    }

    &:hover img {
      filter: brightness(1.15);
    }

    &.is-selected,
    &:focus-visible {
      outline: none;
      box-shadow:
        0 0 0 2px var(--ed-accent),
        0 0 0 4px color-mix(in srgb, var(--ed-accent) 24%, transparent);
    }

    // the field's photo now
    &.is-current::after {
      content: 'in use here';
      position: absolute;
      left: 4px;
      bottom: 4px;
      padding: 0 8px;
      border-radius: 999px;
      font-size: 10px;
      line-height: 16px;
      color: #000;
      background: var(--fg);
    }
  }

  // an upload: the file itself, dimmed, with how far it is
  .mtile--busy {
    cursor: default;

    img {
      filter: brightness(0.4);
    }
  }

  .mtile__state {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: 11px;
    color: var(--fg);
  }

  .md-detail {
    overflow: auto;
    padding: 16px 24px 24px;
    display: grid;
    align-content: start;
    gap: 12px;

    .hint {
      margin: 0;
      overflow-wrap: anywhere;
    }
  }

  .md-detail__head {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 32px;
  }

  .md-detail__title {
    flex: 1;
    min-width: 0;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--fg);
  }

  .md-preview {
    width: 100%;
    max-height: 320px;
    object-fit: contain;
    border-radius: 8px;
    background: var(--bg-2);
  }

  .md-uses {
    display: grid;
  }

  .confirm {
    flex-wrap: wrap;
  }
</style>
