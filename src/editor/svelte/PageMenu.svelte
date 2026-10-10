<!--
  Page picker in the toolbar. A page navigates the preview; a component (Menu, Footer)
  keeps the page and switches the Content tab to its fields. A Select: the title (and in the
  list the path under it) on the left, the kind as a badge at the right edge.
-->
<script>
  import Select from './Select.svelte';

  // items: [{ kind: 'page', path, title, group, items? } | { kind: 'component', id, title }]
  // (a [slug] template has items: its pages)
  // value: the current item; onchange(item): an item was picked
  let { items, value, onchange } = $props();

  const key = (item) =>
    item?.kind === 'component' ? `component:${item.id}` : `page:${item?.path}`;
  const kindName = (item) =>
    item?.kind === 'component' ? 'Component' : item?.items ? 'Template' : 'Page';
  // Pages by folder (item.group: "Pages" or "/people/"), then Components
  const options = $derived(
    Object.entries(
      Object.groupBy(items, (i) => (i.kind === 'component' ? 'Components' : i.group || 'Pages')),
    ).map(([group, list]) => ({
      group,
      options: list.map((item) => ({ value: key(item), label: item.title, item })),
    })),
  );
</script>

{#snippet badge(item)}
  <span class={['pm__badge', item.kind === 'component' && 'is-component']}>{kindName(item)}</span>
{/snippet}

<Select aria-label="Page" value={key(value)} {options} onchange={(_, o) => onchange(o.item)}>
  {#snippet selected(o)}<span class="pm__label">{o.label}</span>{@render badge(o.item)}{/snippet}
  {#snippet option(o)}
    <span class="pm__title">
      {o.label}
      {#if o.item.path}<span class="pm__path">{o.item.path}</span>{/if}
    </span>
    {@render badge(o.item)}
  {/snippet}
</Select>

<style lang="scss">
  // the button: the title, cut with …, then the badge; the caret stays after it
  :global(.sel__value):has(> .pm__label) {
    display: flex;
    align-items: center;
    gap: 8px;
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
    font-size: 9px;
    line-height: 16px; // 16px tall: the button stays 32px
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 0 8px;
    border-radius: 999px;
    color: var(--faint);
    box-shadow: inset 0 0 0 1px var(--line);

    &.is-component {
      color: #e6dcc4;
      box-shadow: inset 0 0 0 1px rgb(230 220 196 / 0.35);
    }
  }

  // a list row: title and path left, the badge at the right edge, on the title's line
  :global(.sel__opt) > .pm__badge {
    align-self: flex-start;
  }

  .pm__title {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .pm__path {
    font-size: 10.5px;
    color: var(--muted);
  }
</style>
