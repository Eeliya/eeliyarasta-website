<!-- mock: the Media window picking several photos (opened from a photo list's Add photo).
     Clicking a tile toggles it; badges number the pick order; the footer adds them, in that
     order. A single photo field keeps its one-click pick (Use this photo). Styles: copied
     from MediaModal.svelte (scoped there). -->
<script>
  import ExplorerHead from '../../src/editor/svelte/ExplorerHead.svelte';
  import Tabs from '../../src/editor/svelte/Tabs.svelte';
  import Button from '../../src/editor/svelte/Button.svelte';

  let { picked = [], caption = '' } = $props();
  const KEYS = [
    'places/kasteel-de-haar/02.jpg', 'people/noor-vermeer/01.jpg', 'people/noor-vermeer/02.jpg',
    'people/noor-vermeer/03.jpg', 'people/noor-vermeer/04.jpg', 'people/noor-vermeer/05.jpg',
    'people/daan-okafor/01.jpg', 'people/daan-okafor/02.jpg', 'people/daan-okafor/05.jpg',
    'people/daan-okafor/06.jpg', 'people/noor-vermeer/06.jpg', 'people/noor-vermeer/07.jpg',
    'people/noor-vermeer/08.jpg', 'about/x100v.jpg', 'places/kasteel-de-haar/01.jpg',
  ];
  const url = (k) => `/media/${k}`;
  const last = $derived(picked.length ? KEYS[picked.at(-1)] : '');
  const n = $derived(picked.length);
</script>

<div class="col">
  <p class="cap">{caption}</p>
  <div class="modal__box md-modal">
    <ExplorerHead title="Media" icon="fa-images" sep="/" crumbs={[{ label: 'media' }]} onclose={() => {}} />
    <nav class="md-list" aria-label="Photos">
      <div class="row md-list__head">
        <Tabs class="md-filter" role="group" label="Show" tabs={[['all', 'All'], ['r2', 'R2'], ['local', 'Local']]} value="all" onpick={() => {}} />
        <Button size="small" icon="upload">Upload</Button>
      </div>
      <ul class="md-grid">
        {#each KEYS as k, i (k)}
          {@const at = picked.indexOf(i)}
          <li>
            <button type="button" class={['mtile', at >= 0 && 'is-picked']} aria-pressed={at >= 0}>
              <img src={url(k)} alt="" />
              {#if at >= 0}<span class="mtile__num">{at + 1}</span>{/if}
            </button>
          </li>
        {/each}
      </ul>
    </nav>
    <section class="md-detail">
      {#if last}
        <header class="md-detail__head"><h4 class="md-detail__title">{last.split('/').pop()}</h4></header>
        <img class="md-preview" src={url(last)} alt="" />
        <p class="hint small">The last one picked. Click a photo again to leave it out; they are added in the order of their numbers.</p>
      {:else}
        <p class="hint">Pick the photos to add, in order: each one you click gets its number. Click it again to leave it out.</p>
      {/if}
    </section>
    <footer class="md-foot">
      <span class="hint small">{n ? `${n} picked` : 'None picked'}</span>
      <Button size="small">Cancel</Button>
      <Button variant="primary" size="small" icon="plus" disabled={!n}>{n ? `Add ${n} photo${n === 1 ? '' : 's'}` : 'Add photos'}</Button>
    </footer>
  </div>
</div>

<style lang="scss">
  .col { display: flex; flex-direction: column; gap: 12px; }
  .cap { margin: 0; min-height: 16px; color: var(--c-text-muted); font-size: var(--fs-sm); line-height: 16px; }

  // MediaModal's dialog.md-modal, plus a footer row
  .md-modal {
    position: static;
    width: 1040px;
    height: 640px;
    display: grid;
    grid-template-columns: minmax(320px, 1fr) minmax(320px, 400px);
    grid-template-rows: auto minmax(0, 1fr) auto;
    padding: 0;
    overflow: hidden;
  }
  .md-modal > :global(:first-child) { grid-column: 1 / -1; }
  .md-list { overflow: auto; padding: var(--space-4) var(--space-4) var(--space-5); border-right: 1px solid var(--c-line); }
  .md-list__head { justify-content: space-between; padding: 0 0 var(--space-3); }
  .md-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: var(--space-2); }
  .mtile {
    position: relative; display: block; width: 100%; aspect-ratio: 1; padding: 0; border: 0;
    border-radius: var(--radius-md); overflow: hidden; cursor: pointer;
    background: var(--c-control); box-shadow: inset 0 0 0 1px var(--c-line);
    img { width: 100%; height: 100%; object-fit: cover; }
    &.is-picked { box-shadow: 0 0 0 2px var(--c-accent), 0 0 0 4px color-mix(in srgb, var(--c-accent) 24%, transparent); }
  }
  // the pick order: a solid accent badge, top left
  .mtile__num {
    position: absolute; left: 4px; top: 4px; width: 24px; height: 24px;
    display: grid; place-items: center; border-radius: var(--radius-pill);
    font-size: var(--fs-sm); font-weight: 600; font-variant-numeric: tabular-nums;
    color: var(--c-on-accent); background: var(--c-accent);
  }
  .md-detail { overflow: auto; padding: var(--space-4) var(--space-5) var(--space-5); display: grid; align-content: start; gap: var(--space-3); .hint { margin: 0; } }
  .md-detail__head { display: flex; align-items: center; min-height: var(--size-control); }
  .md-detail__title { flex: 1; margin: 0; font-size: var(--fs-base); font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: var(--c-text); }
  .md-preview { width: 100%; max-height: 320px; object-fit: contain; border-radius: var(--radius-md); background: var(--c-surface); }
  // the footer: a fixed height, the count left, the buttons right (their width can change)
  .md-foot {
    grid-column: 1 / -1; display: flex; align-items: center; justify-content: flex-end; gap: var(--space-3);
    height: 56px; padding: 0 var(--space-4); border-top: 1px solid var(--c-line);
    .hint { margin: 0 auto 0 0; }
  }
</style>
