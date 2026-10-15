<!--
  An empty section's view (ui.section; a section with blocks goes into its first block's view,
  BlockInspector.svelte): its top (SectionTop.svelte: Back, title, Locate, settings), then a
  dashed Add block card in the place of the block's card (onadd: the block types modal, the
  block added opens in its own view).
    live, bridge, file, id (the section's), onback, onadd(at)
-->
<script>
  import SectionTop from './SectionTop.svelte';

  let { live, bridge, file, id, onback, onadd } = $props();

  // found by its id: it keeps its view while sections move above it
  const at = $derived.by(() => {
    live.version;
    const list = live.current(file)?.sections;
    return Array.isArray(list) ? list.findIndex((s) => s?.id === id) : -1;
  });
</script>

{#if at >= 0}
  <SectionTop {live} {bridge} {file} {at} {onback} />
  <p class="hint small">No blocks in this section yet.</p>
  <button type="button" class="add" aria-haspopup="dialog" onclick={() => onadd(at)}>
    <i class="fa-solid fa-plus" aria-hidden="true"></i>Add block
  </button>
{/if}

<style lang="scss">
  @use '../styles/mixins' as *;

  // a dashed card the block card's width (its -8px bleed), + and its name centred, 40px as
  // the list's Add section
  .add {
    @include row(var(--space-2));
    justify-content: center;
    width: calc(100% + 16px);
    height: 40px;
    margin-inline: -8px;
    border: 1px dashed var(--c-line);
    border-radius: var(--radius-lg);
    background: none;
    color: var(--c-text);
    font: inherit;
    font-size: var(--fs-base);
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;

    &:hover,
    &:focus-visible {
      border-color: var(--c-accent);
      color: var(--c-text-strong);
      outline: none;
    }
  }
</style>
