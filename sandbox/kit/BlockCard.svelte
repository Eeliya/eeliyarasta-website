<!--
  A block's row in a section card, SectionsList.svelte's markup with its own styles (styles.js):
  grip, name, its eye (visibility), Duplicate, Delete, its title under it (a hidden one's name
  and title faint, as built). Put it in a <ul class="blocks">
  (SectionCard does).
    block   { type, title?, config? }     tools   snippet: replaces eye / Duplicate / Delete
-->
<script>
  import Button from '../../src/editor/svelte/Button.svelte';
  import { labelOf } from './sample.js';

  let { block, tools } = $props();
  const label = $derived(labelOf(block));
</script>

<li class={['block', block.config?.enabled === false && 'kit-off']} data-row>
  <span class="block__grip" aria-hidden="true"><i class="fa-solid fa-grip-vertical"></i></span>
  <button type="button" class="block__open">{label}</button>
  {#if tools}{@render tools()}{:else}
    <Button
      size="small"
      icon={block.config?.enabled === false ? 'eye-slash' : 'eye'}
      iconOnly
      label="Show {label}"
      aria-pressed={block.config?.enabled !== false}
      data-eye
    />
    <Button size="small" icon="copy" iconOnly label="Duplicate {label}" />
    <Button size="small" icon="trash" iconOnly label="Delete {label}" />
  {/if}
  {#if block.title}<button type="button" class="block__title" tabindex="-1">{block.title}</button
    >{/if}
</li>

<style lang="scss">
  // hidden: its name and title faint, as SectionsList's .block.is-off > button (the kit's
  // copy of that rule would fade the icons too: not used)
  .kit-off > :global(.block__open),
  .kit-off > :global(.block__title) {
    color: var(--c-text-faint);
  }
</style>
