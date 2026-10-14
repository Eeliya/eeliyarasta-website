<!-- mock: a section's delete question over the whole card at its own size (the kit's
     SectionCard `over`): a solid band at the top with the full question (wraps) and Cancel /
     Delete under it, the rest of the card under --c-card at 65%; a band taller than the card
     scrolls inside it -->
<script>
  import Button from '../../src/editor/svelte/Button.svelte';

  let { text, band = true } = $props(); // band: false, no solid band: the dim is the only background
</script>

<div class="kit-over cover" role="alertdialog" aria-label={text}>
  <div class={['cover__band', !band && 'cover__band--flat']}>
    <p class="cover__msg">{text}</p>
    <span class="cover__btns">
      <Button size="small">Cancel</Button>
      <Button size="small" variant="danger" icon="trash">Delete</Button>
    </span>
  </div>
  <span class="cover__dim" aria-hidden="true"></span>
</div>

<style lang="scss">
  .cover:has(.cover__band--flat) {
    background: color-mix(in srgb, var(--c-card) 65%, transparent);

    .cover__dim {
      background: none;
    }
  }

  .cover {
    display: flex;
    flex-direction: column;
    overflow: auto;
  }

  .cover__band {
    display: grid;
    flex: none;
    gap: var(--space-2);
    padding: var(--space-3);
    background: var(--c-card);
  }

  .cover__msg {
    margin: 0;
    color: var(--c-text-strong);
    font-size: var(--fs-base);
    font-weight: 500;
    letter-spacing: 0.1em;
    line-height: 20px;
    text-transform: uppercase;
    overflow-wrap: anywhere;
  }

  .cover__btns {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }

  .cover__band--flat {
    background: none;
  }

  // Eeliya's exception: the card's own colour, translucent, over the rest of the card
  .cover__dim {
    flex: 1;
    background: color-mix(in srgb, var(--c-card) 65%, transparent);
  }
</style>
