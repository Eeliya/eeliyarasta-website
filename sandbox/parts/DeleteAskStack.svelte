<!-- mock: a section's delete question over a card of a fixed height (the kit's SectionCard
     `over`, height CARD_H): the full question on a solid band at the top (wraps; 3 lines, then
     it scrolls), the rest of the card under --c-card at 65%, Cancel / Delete pinned to the
     card's bottom so they never move -->
<script module>
  // 12px + 3 lines of 20px + 12px band, 8px, the 32px buttons, 12px: 136px, inside the 1px border
  export const CARD_H = '138px';
</script>

<script>
  import Button from '../../src/editor/svelte/Button.svelte';

  let { text } = $props();
</script>

<div class="kit-over stack" role="alertdialog" aria-label={text}>
  <p class="stack__msg">{text}</p>
  <span class="stack__dim" aria-hidden="true"></span>
  <span class="stack__btns">
    <Button size="small">Cancel</Button>
    <Button size="small" variant="danger" icon="trash">Delete</Button>
  </span>
</div>

<style lang="scss">
  .stack {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    overflow: hidden;
  }

  .stack__msg {
    max-height: 84px; // 3 lines and the padding, then it scrolls
    margin: 0;
    padding: var(--space-3) var(--space-3);
    overflow: auto;
    background: var(--c-card);
    color: var(--c-text-strong);
    font-size: var(--fs-base);
    font-weight: 500;
    letter-spacing: 0.1em;
    line-height: 20px;
    text-transform: uppercase;
    overflow-wrap: anywhere;
  }

  // Eeliya's exception: the card's own colour, translucent, over whatever is below the band
  .stack__dim {
    background: color-mix(in srgb, var(--c-card) 65%, transparent);
  }

  .stack__btns {
    position: absolute;
    right: var(--space-3);
    bottom: var(--space-3);
    display: flex;
    gap: var(--space-2);
  }
</style>
