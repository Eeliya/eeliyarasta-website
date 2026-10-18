<!--
  The top of a section's or a block's settings (SectionView.svelte, BlockInspector.svelte), one
  level under the list of sections: a 32px row, ← Back (to the list, SectionsList.svelte; Esc
  or a click on empty space in the preview too) and Locate (the preview scrolls to it).
    bridge, id (the section's or block's), onback
-->
<script>
  import Button from './Button.svelte';
  import { locate } from '../locate.js';

  let { bridge, id, onback } = $props();
</script>

<div class="top">
  <button type="button" class="top__back" title="Back to the sections" onclick={onback}>
    <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>Back
  </button>
  <Button
    size="small"
    icon="location-crosshairs"
    iconOnly
    label="Show it in the preview"
    title="Show in preview"
    onclick={() => locate(bridge, id)}
  />
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  // [ ← Back            locate ]: 32px, as wide as the cards (their -8px bleed); Back's text
  // and Locate's icon on the cards' 12px edges
  .top {
    @include row(var(--space-2));
    flex: none;
    justify-content: space-between;
    height: var(--size-control);
    margin-inline: -8px;
    padding-right: var(--space-3);
  }

  .top__back {
    @include row(var(--space-2));
    height: var(--size-control);
    padding: 0 var(--space-3);
    border: 0;
    border-radius: var(--radius-md);
    background: none;
    color: var(--c-text);
    font: inherit;
    font-size: var(--fs-base);
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;

    &:hover {
      background: var(--c-surface-2);
      color: var(--c-text-strong);
    }

    &:focus-visible {
      @include focus-ring;
    }
  }
</style>
