<!--
  The body of a Content group (content-groups.js): a block's settings (its type's config:
  source, layout, ...) and fields, or the other texts of the page. Fields are in rows
  (.fields): two half fields share one (pairedHalves); a list field is a ListField.

    g         the group
    live      reactive store (live.svelte.js); bridge: the preview (../bridge.js)
    sourceIds the files in content/en/sources/, for a list item's source
    onsource  (file, item?, edit?): open the Source Explorer
    bindings  a block's: { binds(type), resolved(f), from } for its fields' pickers (Custom or
              a field of its item) and a bound text's format (BlockInspector.svelte,
              Field.svelte); null: none
    lead      snippet: first in the grid (the block's source, BlockSource.svelte)
  Settings and content share one .fields grid (all through Field, the same labels and gaps),
  a 1px line between them when both are there.
-->
<script>
  import Field from './Field.svelte';
  import LinkField from './LinkField.svelte';
  import ListField from './ListField.svelte';
  import PhotoList from './PhotoList.svelte';
  import { ui } from './ui.svelte.js';
  import { runsOf, isSource } from './content-groups.js';
  import { parse } from '../lib/pointer.js';
  import { openMedia } from './media.svelte.js';
  import { pairedHalves } from './source-items.js';
  import ItemPicker from './ItemPicker.svelte';
  import { sourceFile } from '../../site/files.js';
  import { isBinding } from '../../site/layout/bindings.js';

  let { g, live, bridge, sourceIds, onsource, bindings = null, lead } = $props();

  // a setting changes what the block shows: the preview renders it again (structure)
  function setConfig(c, value) {
    live.store.set(g.file, c.ptr, value, {
      key: `config:${g.file}${c.ptr}`,
      source: 'panel',
      structure: true,
    });
  }

  // ---- list fields (ListField.svelte): the whole list in one change, one undo step
  const listOf = (f) => [...(live.get(f.file, f.ptr) || [])];
  const setList = (f, list) =>
    live.store.set(f.file, f.ptr, list, { source: 'panel', structure: true });

  function moveItem(f, from, to) {
    const list = listOf(f);
    list.splice(to, 0, ...list.splice(from, 1));
    setList(f, list);
  }

  function removeItem(f, i) {
    const list = listOf(f);
    list.splice(i, 1);
    setList(f, list);
  }

  /** A new item at the end; a photo list opens the Media window to pick its photos instead. */
  function addItem(f) {
    if (f.photo !== null)
      return openMedia({ multi: { list: f.edit, item: f.item, photo: f.photo || '' } });
    setList(f, [...listOf(f), structuredClone(f.item)]);
  }

  /** A list whose items have a photo (the Hero's): PhotoList.svelte, the photo first. */
  const photoList = (f) => f.photo !== null && f.items.every((fs) => fs.some(isPhoto));
  const isPhoto = (sub) => sub.type === 'image';

  /** A list item's name in its bar: its label or title, else "<list> <n>". */
  function itemName(f, fields, i) {
    const own = fields.find((sub) => /\/(label|title)$/.test(sub.ptr));
    const text = own && live.get(own.file, own.ptr);
    return typeof text === 'string' && text.trim() ? text : `${f.label} ${i + 1}`;
  }

  // a switch or a choice can change what the block shows: rendered again
  // a bound value ({ bind }) shows the item's: rendered again too
  function setValue(f, value) {
    const structure =
      f.type === 'boolean' ||
      f.type === 'select' ||
      isBinding(value) ||
      isBinding(live.get(f.file, f.ptr));
    const typed = f.type !== 'boolean' && f.type !== 'select' && typeof value !== 'object';
    live.store.set(f.file, f.ptr, value, {
      source: 'panel',
      structure,
      ...(typed ? { key: `text:${f.edit}` } : {}),
    });
  }

  // a source's items (for the source fields' counts)
  const itemsOf = (id) => {
    live.version;
    const list = live.get(sourceFile(id), '/items');
    return Array.isArray(list) ? list : [];
  };
  const itemOf = (f) => Number(parse(f.ptr)[0]) || 0; // a source field's item
  // the settings shown: a source, a choice, a switch, a link (in the config's order)
  const settings = $derived(
    g.config?.filter(
      (c) => c.type === 'source' || c.type === 'link' || c.options || c.type === 'boolean',
    ) ?? [],
  );
</script>

<!-- one field: a Field (text, photo, switch, choice), or a source field (a list item's
     source, ItemPicker.svelte) -->
{#snippet field(f, half, extra = {})}
  {#if f.type === 'source'}
    <ItemPicker
      store={live.store}
      mode="source"
      value={live.get(f.file, f.ptr)}
      changed={live.changed(f.file, f.ptr)}
      none={null}
      {sourceIds}
      {itemsOf}
      {onsource}
      onpick={(v) => live.store.set(f.file, f.ptr, v, { source: 'panel', structure: true })}
      onclear={() => live.store.remove(f.file, f.ptr, { source: 'panel', structure: true })}
    />
  {:else if f.type === 'link'}
    <LinkField
      {live}
      edit={f.edit}
      label={f.label}
      value={live.get(f.file, f.ptr)}
      changed={live.changed(f.file, f.ptr)}
      empty="No link"
      binds={bindings ? bindings.binds('link') : null}
      onfocus={() => bridge.focusEdit(f.edit)}
      onvalue={(value) =>
        live.store.set(f.file, f.ptr, value, { source: 'panel', structure: true })}
    />
  {:else}
    <Field
      {...f}
      {half}
      value={live.get(f.file, f.ptr)}
      changed={live.changed(f.file, f.ptr)}
      selected={ui.selection?.edit === f.edit}
      source={isSource(f.file) ? f.file : ''}
      onsource={() => onsource(f.file, itemOf(f), f.edit)}
      onfocus={() => bridge.focusEdit(f.edit)}
      onvalue={(value) => setValue(f, value)}
      binds={bindings && f.bindType && f.type !== 'boolean' ? bindings.binds(f.bindType) : null}
      from={bindings?.from ?? ''}
      formats={!!bindings && f.textual}
      resolved={bindings?.resolved(f) ?? ''}
      {...extra}
    />
  {/if}
{/snippet}

<!-- fields in rows: a half field shares its row with the next half -->
{#snippet rows(fields)}
  {@const halves = pairedHalves(fields)}
  <div class="fields">
    {#each fields as f (f.edit)}{@render field(f, halves.has(f.edit))}{/each}
  </div>
{/snippet}

<!-- a block setting (config): a source field (ItemPicker.svelte: its source only), a Select
     (select), a switch (boolean) through Field, or a link (LinkField) -->
{#snippet option(c)}
  {@const value = live.get(g.file, c.ptr)}
  {#if c.type === 'source'}
    <ItemPicker
      store={live.store}
      mode="source"
      label={c.label}
      {value}
      changed={live.changed(g.file, c.ptr)}
      none={c.empty ?? null}
      {sourceIds}
      {itemsOf}
      {onsource}
      onpick={(v) => setConfig(c, v ?? '')}
      onclear={() => setConfig(c, undefined)}
    />
  {:else if c.type === 'link'}
    <LinkField
      {live}
      edit="{g.file}#{c.ptr}"
      label={c.label}
      {value}
      changed={live.changed(g.file, c.ptr)}
      empty="No link"
      binds={bindings ? bindings.binds('link') : null}
      onvalue={(v) => setConfig(c, v)}
    />
  {:else}
    <Field
      edit="{g.file}#{c.ptr}"
      label={c.label}
      type={c.type === 'boolean' ? 'boolean' : 'select'}
      value={c.type === 'boolean' ? !!value : (value ?? '')}
      options={c.options ?? []}
      changed={live.changed(g.file, c.ptr)}
      onvalue={(v) => setConfig(c, v)}
    />
  {/if}
{/snippet}

<!-- one grid (.fields): the settings (the block's item, `lead`, and its config), a line, then
     the content fields; a list field takes a whole row -->
<div class="fields">
  {@render lead?.()}
  {#each settings as c (c.key)}{@render option(c)}{/each}
  {#if (lead || settings.length) && g.fields.length}<hr class="fields__line" />{/if}
  {#each runsOf(g.fields) as run (run.list?.edit ?? run.fields[0].edit)}
    {#if run.fields}
      {@const halves = pairedHalves(run.fields)}
      {#each run.fields as f (f.edit)}{@render field(f, halves.has(f.edit))}{/each}
    {:else}
      {@const f = run.list}
      {#if photoList(f)}
        <PhotoList
          label={f.label}
          items={f.items}
          addLabel="Add photo"
          onmove={(from, to) => moveItem(f, from, to)}
          onremove={(i) => removeItem(f, i)}
          onadd={() => addItem(f)}
        >
          {#snippet row(fields, i, ctl)}
            {@render field(fields.find(isPhoto), false, { ...ctl, label: `${f.label} ${i + 1}` })}
            {#if fields.some((sub) => !isPhoto(sub))}{@render rows(
                fields.filter((sub) => !isPhoto(sub)),
              )}{/if}
          {/snippet}
        </PhotoList>
      {:else}
        <ListField
          label={f.label}
          items={f.items}
          name={(fields, i) => itemName(f, fields, i)}
          addLabel={f.photo === null ? 'Add' : 'Add photo'}
          onmove={(from, to) => moveItem(f, from, to)}
          onremove={(i) => removeItem(f, i)}
          onadd={() => addItem(f)}
        >
          {#snippet item(fields)}{@render rows(fields)}{/snippet}
        </ListField>
      {/if}
    {/if}
  {/each}
</div>

<style lang="scss">
  // between the settings and the content: a full row, 1px
  .fields__line {
    margin: var(--space-1) 0;
    border: 0;
    border-top: 1px solid var(--c-line);
  }
</style>
