<!--
  A block's row in a section card, SectionsList.svelte's markup with its own styles (styles.js):
  grip, name, Duplicate, Delete, the switch, its title under it. Put it in a <ul class="blocks">
  (SectionCard does).
    block   { type, title?, config? }     tools   snippet: replaces Duplicate / Delete / switch
-->
<script>
  import Button from '../../src/editor/svelte/Button.svelte';
  import { labelOf } from './sample.js';

  let { block, tools } = $props();
  const label = $derived(labelOf(block));
</script>

<li class="block" data-row>
  <span class="block__grip" aria-hidden="true"><i class="fa-solid fa-grip-vertical"></i></span>
  <button type="button" class="block__open">{label}</button>
  {#if tools}{@render tools()}{:else}
    <Button size="small" icon="copy" iconOnly label="Duplicate {label}" />
    <Button size="small" icon="trash" iconOnly label="Delete {label}" />
    <input
      type="checkbox"
      class="switch"
      aria-label="Show {label}"
      checked={block.config?.enabled !== false}
    />
  {/if}
  {#if block.title}<button type="button" class="block__title" tabindex="-1">{block.title}</button
    >{/if}
</li>
