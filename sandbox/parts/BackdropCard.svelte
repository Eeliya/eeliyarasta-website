<!-- mock: the page's Backdrop card (Content tab, above Section 1). state: scroll | fade | empty -->
<script>
  import Section from '../../src/editor/svelte/Section.svelte';
  import Field from '../../src/editor/svelte/Field.svelte';
  import PhotoList from '../../src/editor/svelte/PhotoList.svelte';

  let { state = 'scroll', caption = '' } = $props();
  const PHOTOS = ['places/kasteel-de-haar/02.jpg', 'people/noor-vermeer/02.jpg', 'people/daan-okafor/02.jpg'];
  const photos = $derived(state === 'empty' ? [] : PHOTOS);
  const items = $derived(photos.map((src, i) => [{ edit: `mock#/backdrop/${i}`, type: 'image', label: `Photo ${i + 1}`, value: src }]));
  const nop = () => {};
</script>

{#snippet seg(options, now, label)}
  <div class="seg" role="radiogroup" aria-label={label}>
    {#each options as o (o)}
      <button type="button" role="radio" aria-checked={o === now} class={['seg__btn', o === now && 'is-active']}>{o}</button>
    {/each}
  </div>
{/snippet}

<div class="col">
  <p class="cap">{caption}</p>
  <div class="panel">
    <Section title="Backdrop" name={photos.length ? `${photos.length} photos · ${state === 'fade' ? 'Fade' : 'Scroll'}` : ''} dim={!photos.length} open={!!photos.length || true}>
      {#snippet bar()}
        <input type="checkbox" class="switch" checked={!!photos.length} disabled={!photos.length} aria-label="Show the backdrop" />
      {/snippet}
      <div class="fields">
        {#if !photos.length}
          <p class="hint small empty">Photos behind the sections, one after another: the first at the top, the last until the end. Section backgrounds sit on top.</p>
        {/if}
        <PhotoList label="Photos" {items} addLabel="Add photo" onmove={nop} onremove={nop} onadd={nop}>
          {#snippet row(fields, _i, ctl)}
            <Field {...fields[0]} grab={ctl.grab} remove={ctl.remove} onvalue={nop} />
          {/snippet}
        </PhotoList>
        {#if photos.length}
          <hr class="line" />
          <div class="tf">
            <span class="tf__label">Transition</span>
            {@render seg(['Scroll', 'Fade'], state === 'fade' ? 'Fade' : 'Scroll', 'Transition')}
          </div>
          <!-- the transition's options: one slot, the same height for both -->
          <div class="slot">
            {#if state === 'fade'}
              <div class="tf">
                <span class="tf__label">Fade</span>
                {@render seg(['Direct', 'Through black'], 'Through black', 'Fade')}
              </div>
              <div class="pair">
                <Field label="Parallax" type="boolean" value={true} onvalue={nop} />
                <Field label="Scrub" type="boolean" value={false} onvalue={nop} />
              </div>
            {:else}
              <div class="tf">
                <span class="tf__label">Direction</span>
                {@render seg(['Vertical', 'Horizontal'], 'Vertical', 'Direction')}
              </div>
              <p class="hint small slot__hint">The photos scroll by with the page; the last is fully in view at its end.</p>
            {/if}
          </div>
        {/if}
      </div>
    </Section>
    <div class="next">
      <Section title="Section 1" name="Eeliya Rasta" open={false}>
        {#snippet bar()}<input type="checkbox" class="switch" checked aria-label="Show" />{/snippet}
      </Section>
    </div>
  </div>
</div>

<style lang="scss">
  .col { width: 384px; display: flex; flex-direction: column; gap: 12px; }
  .cap { margin: 0; min-height: 32px; color: var(--c-text-muted); font-size: var(--fs-sm); line-height: 16px; }
  .panel { display: flex; flex-direction: column; gap: 12px; padding: 0 8px; }
  .line { margin: 4px 0; border: 0; border-top: 1px solid var(--c-line); }
  .empty { margin: 0; }

  // Scroll's and Fade's options in one slot of a fixed height (the taller's: a 32px choice and
  // a 32px switch row), so switching never moves what is under it
  .slot { display: grid; grid-template-rows: auto 40px; gap: 12px; }
  .slot__hint { margin: 0; align-self: center; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .pair :global(.tf__label) { justify-content: space-between; margin-bottom: 0; min-height: 32px; }
</style>
