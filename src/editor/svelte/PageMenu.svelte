<!--
  Page picker in the toolbar. A page navigates the preview; a component (Menu, Footer)
  keeps the page and switches the Content tab to its fields. A Select with the kind as a badge
  and the path under the title.
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
  {#snippet selected(o)}{@render badge(o.item)}{o.label}{/snippet}
  {#snippet option(o)}
    {@render badge(o.item)}
    <span class="pm__title">
      {o.label}
      {#if o.item.path}<span class="pm__path">{o.item.path}</span>{/if}
    </span>
  {/snippet}
</Select>

<style lang="scss">
  .pm__badge {
    flex: none;
    display: inline-block;
    vertical-align: top;
    margin-right: 8px;
    font-size: 9px;
    line-height: 12px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 4px 8px;
    border-radius: 999px;
    color: var(--faint);
    box-shadow: inset 0 0 0 1px var(--line);

    &.is-component {
      color: #e6dcc4;
      box-shadow: inset 0 0 0 1px rgb(230 220 196 / 0.35);
    }
  }

  // the gap between badge and title: margin in the button, the option row's gap in the list
  :global(.sel__opt) > .pm__badge {
    margin-right: 0;
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
