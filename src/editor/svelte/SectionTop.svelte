<!--
  The top of a section's view (BlockInspector.svelte, SectionView.svelte), plain (not a card):
  Back (to the list of sections, SectionsList.svelte; Esc or a click on empty space in the
  preview also goes back), the section's title (dim when only "Section N") and Locate, then its
  settings, editable, in an outlined box (SectionSettings.svelte).
    live, bridge, file, at (the section's index), onback
-->
<script>
  import Button from './Button.svelte';
  import SectionSettings from './SectionSettings.svelte';
  import { locate } from '../locate.js';

  let { live, bridge, file, at, onback } = $props();

  // a fresh copy after every edit (SectionSettings reads the values from it)
  const sections = $derived.by(() => {
    const list = live.current(file)?.sections;
    return Array.isArray(list) ? list : [];
  });
  const secTitle = $derived.by(() => {
    const n = sections[at]?.name;
    return typeof n === 'string' && n.trim() ? n.trim() : '';
  });
</script>

<!-- its section: Back, its title (dim when only "Section N") and Locate; its settings in an outlined box -->
<div class="sec-top">
  <div class="sec-head">
    <Button
      icon="arrow-left"
      iconOnly
      label="Back to sections"
      title="Back to sections"
      onclick={onback}
    />
    <span class={['sec-title', !secTitle && 'is-default']}>{secTitle || `Section ${at + 1}`}</span>
    <Button
      size="small"
      icon="location-crosshairs"
      iconOnly
      label="Show this section in the preview"
      title="Show in preview"
      onclick={() => locate(bridge, sections[at]?.id)}
    />
  </div>
  <div class="sec-box"><SectionSettings {live} {file} {at} {sections} /></div>
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  // its section: a plain area (not a card), then the block's card
  .sec-top {
    @include stack(var(--space-3));
    margin-inline: -8px; // as wide as the list's section cards
  }

  // its settings in a 1px outlined box, no fill (the block below is a filled card)
  .sec-box {
    padding: var(--space-3);
    border: 1px solid var(--c-line);
    border-radius: var(--radius-lg);
  }

  .sec-head {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-2);
  }

  .sec-title {
    @include ellipsis;
    color: var(--c-text);
    font-size: var(--fs-base);
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;

    &.is-default {
      color: var(--c-text-faint);
    }
  }
</style>
