<!--
  The page's backdrop (src/site/backdrop.js): photos behind its sections as it scrolls, at the
  top of the Content tab above Section 1. Its photos (PhotoList.svelte: drag a photo to move
  it, Media to change, ✕ to remove, Add photo opens Media), then its transition: Scroll (a
  direction) or Fade (direct or through black, Parallax, Scrub). The options sit in one slot of
  a fixed height, so switching Scroll and Fade moves nothing under it. The bar's switch turns
  it off (enabled: false) without losing its photos. Every change is one undo step; a value
  set back to its default is left out (BACKDROP_DEFAULTS), and so is an empty backdrop on
  save. The preview shows it at once (main.js syncBackdrop).
    live  reactive store; file  the page file
-->
<script>
  import Field from './Field.svelte';
  import PhotoList from './PhotoList.svelte';
  import Section from './Section.svelte';
  import { openMedia } from './media.svelte.js';
  import { BACKDROP_DEFAULTS } from '../../site/backdrop.js';

  let { live, file } = $props();

  const b = $derived.by(() => {
    live.version;
    const v = live.get(file, '/backdrop');
    // a copy: the store changes its objects in place, and a derived of the same object stays put
    return v && typeof v === 'object' && !Array.isArray(v) ? { ...v } : {};
  });
  const photos = $derived(Array.isArray(b.photos) ? [...b.photos] : []);
  const has = $derived(photos.some(Boolean));
  const transition = $derived(b.transition === 'fade' ? 'fade' : 'scroll');
  const on = $derived(b.enabled !== false);
  const shade = $derived(
    Math.round((typeof b.shade === 'number' ? b.shade : BACKDROP_DEFAULTS.shade) * 100),
  );
  const items = $derived(
    photos.map((_, i) => [
      {
        edit: `${file}#/backdrop/photos/${i}`,
        file,
        ptr: `/backdrop/photos/${i}`,
        type: 'image',
        label: `Photo ${i + 1}`,
      },
    ]),
  );
  const changed = (key) => live.changed(file, `/backdrop/${key}`);

  /** A setting; its default is left out. */
  function set(key, value) {
    const ptr = `/backdrop/${key}`;
    if (value === BACKDROP_DEFAULTS[key]) live.store.remove(file, ptr, { source: 'panel' });
    else live.store.set(file, ptr, value, { source: 'panel', key: `backdrop:${file}${ptr}` });
  }
  const setPhotos = (list) => live.store.set(file, '/backdrop/photos', list, { source: 'panel' });
  function move(from, to) {
    const list = [...photos];
    list.splice(to, 0, ...list.splice(from, 1));
    setPhotos(list);
  }
  function removeAt(i) {
    const list = [...photos];
    list.splice(i, 1);
    setPhotos(list);
  }
  /** Media opens to pick photos (they land at the end of the list, in the order picked). */
  function add() {
    openMedia({ multi: { list: `${file}#/backdrop/photos`, item: '', photo: '' } });
  }

  const name = $derived(
    has
      ? `${photos.length} photo${photos.length === 1 ? '' : 's'} · ${transition === 'fade' ? 'Fade' : 'Scroll'}`
      : '',
  );
</script>

<!-- a value picker (not tabs): a group of buttons, the picked one filled -->
{#snippet choice(key, title, options, now)}
  <div class={['tf', changed(key) && 'is-changed']}>
    <span class="tf__label">{title}</span>
    <div class="seg" role="radiogroup" aria-label={title}>
      {#each options as [value, label] (value)}
        <button
          type="button"
          role="radio"
          aria-checked={now === value}
          class={['seg__btn', now === value && 'is-active']}
          onclick={() => set(key, value)}>{label}</button
        >
      {/each}
    </div>
  </div>
{/snippet}

<Section
  id="backdrop"
  key="text:{file}#backdrop"
  title="Backdrop"
  {name}
  dim={!has}
  off={has && !on}
  changed={live.changed(file, '/backdrop')}
>
  {#snippet bar()}
    <input
      type="checkbox"
      class="switch"
      aria-label="Show the backdrop"
      title={!has ? 'Add a photo first' : on ? 'Shown behind the sections' : 'Hidden'}
      disabled={!has}
      checked={has && on}
      onchange={(e) => set('enabled', e.currentTarget.checked)}
    />
  {/snippet}
  <div class="fields">
    {#if !has}
      <p class="hint small bd__hint">
        Photos behind the sections, one after another: the first at the top, the last until the end.
        Section backgrounds sit on top.
      </p>
    {/if}
    <PhotoList
      label="Photos"
      {items}
      addLabel="Add photo"
      onmove={move}
      onremove={removeAt}
      onadd={add}
    >
      {#snippet row(fields, i, ctl)}
        {@const f = fields[0]}
        <Field
          {...f}
          value={photos[i]}
          changed={live.changed(file, f.ptr)}
          grab={ctl.grab}
          remove={ctl.remove}
          onvalue={(v) => (v ? live.store.set(file, f.ptr, v, { source: 'panel' }) : removeAt(i))}
        />
      {/snippet}
    </PhotoList>
    {#if has}
      <hr class="bd__line" />
      {@render choice(
        'transition',
        'Transition',
        [
          ['scroll', 'Scroll'],
          ['fade', 'Fade'],
        ],
        transition,
      )}
      <!-- the dim over the photos, for both transitions; the value has a fixed width -->
      <div class={['tf', changed('shade') && 'is-changed']}>
        <span class="tf__label">Shade</span>
        <div class="bd__shade">
          <input
            type="range"
            class="f__range"
            min="0"
            max="80"
            step="5"
            aria-label="Shade"
            value={shade}
            oninput={(e) => set('shade', Math.round(+e.currentTarget.value) / 100)}
          />
          <span class="bd__val">{shade}%</span>
        </div>
      </div>
      <!-- the transition's options: one slot of a fixed height (a choice, then a 40px row) -->
      <div class="bd__slot">
        {#if transition === 'fade'}
          {@render choice(
            'through',
            'Fade',
            [
              ['none', 'Direct'],
              ['black', 'Through black'],
            ],
            b.through === 'none' ? 'none' : 'black',
          )}
          <div class="bd__pair">
            <Field
              edit="{file}#/backdrop/parallax"
              label="Parallax"
              type="boolean"
              value={b.parallax === true}
              changed={changed('parallax')}
              onvalue={(v) => set('parallax', v)}
            />
            <Field
              edit="{file}#/backdrop/scrub"
              label="Scrub"
              type="boolean"
              value={b.scrub === true}
              changed={changed('scrub')}
              onvalue={(v) => set('scrub', v)}
            />
          </div>
        {:else}
          {@render choice(
            'direction',
            'Direction',
            [
              ['vertical', 'Vertical'],
              ['horizontal', 'Horizontal'],
            ],
            b.direction === 'horizontal' ? 'horizontal' : 'vertical',
          )}
          <p class="hint small bd__note">
            The photos scroll by with the page; the last is fully in view at its end.
          </p>
        {/if}
      </div>
    {/if}
  </div>
</Section>

<style lang="scss">
  .bd__hint,
  .bd__note {
    margin: 0;
  }

  .bd__line {
    margin: var(--space-1) 0;
    border: 0;
    border-top: 1px solid var(--c-line);
  }

  // Scroll's and Fade's options in one slot: a 32px choice with its label, then a 40px row
  // (the switches, or the note), so switching never moves what is under it
  .bd__slot {
    display: grid;
    grid-template-rows: auto 40px;
    gap: var(--space-3);
  }

  .bd__note {
    align-self: center;
  }

  .bd__shade {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    height: 32px;

    .f__range {
      flex: 1;
    }
  }

  // a fixed width ("80%" fits), so dragging never moves the slider
  .bd__val {
    width: 40px;
    text-align: right;
    font-variant-numeric: tabular-nums;
    color: var(--c-text);
  }

  .bd__pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);

    :global(.tf__label) {
      justify-content: space-between;
      min-height: 32px;
      margin-bottom: 0;
    }
  }
</style>
