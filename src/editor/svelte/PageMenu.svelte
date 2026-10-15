<!--
  Page picker in the toolbar. First a "Site" group with the site parts (Header, Footer): one
  keeps the page and switches the Content tab to it; then the pages, which navigate the preview. A Select: the title (and in the
  list the path under it) on the left, the kind as a badge at the right edge.
-->
<script>
  import Select from './Select.svelte';

  // items: [{ kind: 'part', id, title } | { kind: 'page', path, title, group, items? }]
  // (a [slug] template has items: its pages)
  // value: the current item; onchange(item): an item was picked
  let { items, value, onchange } = $props();

  const key = (item) => (item?.kind === 'part' ? `part:${item.id}` : `page:${item?.path}`);
  const kindName = (item) => (item?.kind === 'part' ? 'Site' : item?.items ? 'Template' : 'Page');
  // the site parts ("Site"), then the pages by folder (item.group: "Pages" or "/people/")
  const options = $derived(
    Object.entries(
      Object.groupBy(items, (i) => (i.kind === 'part' ? 'Site' : i.group || 'Pages')),
    ).map(([group, list]) => ({
      group,
      options: list.map((item) => ({ value: key(item), label: item.title, item })),
    })),
  );
</script>

{#snippet badge(item)}
  <span class={['pm__badge', item.kind === 'part' && 'is-part']}>{kindName(item)}</span>
{/snippet}

<Select aria-label="Page" value={key(value)} {options} onchange={(_, o) => onchange(o.item)}>
  {#snippet selected(o)}<span class="pm__label">{o.label}</span>{@render badge(o.item)}{/snippet}
  {#snippet option(o)}
    <span class="pm__title">
      {o.label}
      {#if o.item.kind === 'page'}<span class="pm__path">{o.item.path}</span>{/if}
    </span>
    {@render badge(o.item)}
  {/snippet}
</Select>

<style lang="scss">
  @use '../styles/mixins' as *;

  // the button: the title, cut with …, then the badge; the caret stays after it
  :global(.sel__value):has(> .pm__label) {
    @include row(var(--space-2));
  }

  .pm__label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pm__badge {
    flex: none;
    margin-left: auto;
    font-size: var(--fs-2xs);
    line-height: 16px; // 16px tall: the button stays 32px
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 0 var(--space-2);
    border-radius: var(--radius-pill);
    color: var(--c-text-faint);
    box-shadow: inset 0 0 0 1px var(--c-line);

    &.is-part {
      color: var(--c-warm);
      box-shadow: inset 0 0 0 1px var(--sand-200-a35);
    }
  }

  // a list row: title and path left, the badge at the right edge, on the title's line
  :global(.sel__opt) > .pm__badge {
    align-self: flex-start;
  }

  .pm__title {
    @include stack(var(--space-1));
    min-width: 0;
  }

  .pm__path {
    font-size: var(--fs-2xs);
    color: var(--c-text-muted);
  }
</style>
