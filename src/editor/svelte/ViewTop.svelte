<!--
  The top of a section's or a widget's settings (SectionView.svelte, WidgetInspector.svelte), one
  level under the list of sections: a 32px row, ← Back (to the list, SectionsList.svelte; Esc
  or a click on empty space in the preview too) and Locate (the preview scrolls to it).
    bridge, id (the section's or widget's), onback
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

  // [ ← Back            locate ]: 32px on the panel's 12px edges (Back's arrow where the page
  // head's back arrow is)
  .top {
    @include row(var(--space-2));
    flex: none;
    justify-content: space-between;
    height: var(--size-control);
  }

  .top__back {
    @include row(var(--space-2));
    height: var(--size-control);
    padding: 0;
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
      color: var(--c-text-strong);
    }

    &:focus-visible {
      @include focus-ring;
    }
  }
</style>
