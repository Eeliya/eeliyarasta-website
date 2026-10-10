<!--
  The body of a Content group (content-groups.js): a block's settings (its type's config:
  source, layout, ...) and fields, or the other texts of the page. Fields are in rows
  (.fields): two half fields share one (pairedHalves); a list field is a ListField.

    g         the group
    live      reactive store (live.svelte.js); bridge: the preview (../bridge.js)
    sourceIds the files in content/sources/, for a list item's source
    onsource  (file, item?, edit?): open the Source Explorer
    bindings  a block's: { binds(type), names, resolved(f) } for its fields' Source switch and
              {{name}} suggestions (BlockInspector.svelte, Field.svelte); null: none
-->
<script>
  import Button from './Button.svelte';
  import Field from './Field.svelte';
  import ListField from './ListField.svelte';
  import Select from './Select.svelte';
  import { ui } from './ui.svelte.js';
  import { runsOf, isSource } from './content-groups.js';
  import { parse } from '../lib/pointer.js';
  import { openMedia } from './media.svelte.js';
  import { pairedHalves } from './source-items.js';
  import { baseName } from '../../site/files.js';
  import { isBound } from '../../site/layout/bindings.js';

  let { g, live, bridge, sourceIds, onsource, bindings = null } = $props();
  const uid = $props.id();

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

  /** A new item at the end; a photo item opens the Media window to pick its photo. */
  function addItem(f) {
    const list = listOf(f);
    setList(f, [...list, structuredClone(f.item)]);
    if (f.photo !== null)
      openMedia({ pick: `${f.edit}/${list.length}${f.photo ? `/${f.photo}` : ''}` });
  }

  /** A list item's name in its bar: its label or title, else "<list> <n>". */
  function itemName(f, fields, i) {
    const own = fields.find((sub) => /\/(label|title)$/.test(sub.ptr));
    const text = own && live.get(own.file, own.ptr);
    return typeof text === 'string' && text.trim() ? text : `${f.label} ${i + 1}`;
  }

  // a switch or a choice can change what the block shows: rendered again
  // a bound value (an object, or text with {{name}}) shows the item's: rendered again too
  function setValue(f, value) {
    const structure =
      f.type === 'boolean' ||
      f.type === 'select' ||
      isBound(value) ||
      isBound(live.get(f.file, f.ptr));
    const typed = f.type !== 'boolean' && f.type !== 'select' && typeof value !== 'object';
    live.store.set(f.file, f.ptr, value, {
      source: 'panel',
      structure,
      ...(typed ? { key: `text:${f.edit}` } : {}),
    });
  }

  const itemOf = (f) => Number(parse(f.ptr)[0]) || 0; // a source field's item
  const own = $derived(!!g.source);
  const options = $derived(g.config?.filter((c) => c.options || c.type === 'boolean') ?? []);
</script>

<!-- one field: a Field (text, photo, switch, choice), or a source Select (a list item's
     source); `own` = the group names the source file, so the field doesn't -->
{#snippet field(f, half)}
  {#if f.type === 'source'}
    {@const value = live.get(f.file, f.ptr)}
    <div class={['opt', live.changed(f.file, f.ptr) && 'is-changed']}>
      <label class="tf__label" for="{uid}-{f.edit}"
        >{f.label}<i class="dot" title="Changed"></i></label
      >
      <Select
        id="{uid}-{f.edit}"
        value={value ?? ''}
        placeholder="Pick…"
        options={sourceIds.map((id) => ({ value: id, label: `${id}.json` }))}
        onchange={(v) => live.store.set(f.file, f.ptr, v, { source: 'panel', structure: true })}
      />
    </div>
  {:else}
    <Field
      {...f}
      {half}
      value={live.get(f.file, f.ptr)}
      changed={live.changed(f.file, f.ptr)}
      selected={ui.selection?.edit === f.edit}
      source={!own && isSource(f.file) ? f.file : ''}
      onsource={() => onsource(f.file, itemOf(f), f.edit)}
      onfocus={() => bridge.focusEdit(f.edit)}
      onvalue={(value) => setValue(f, value)}
      binds={bindings && f.bindType && f.type !== 'boolean' ? bindings.binds(f.bindType) : null}
      names={bindings && f.textual ? bindings.names : null}
      resolved={bindings?.resolved(f) ?? ''}
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

<!-- a block setting (config): a Select (source, select) or a switch (boolean), labelled;
     a source has an edit button beside it -->
{#snippet option(c)}
  {@const value = live.get(g.file, c.ptr)}
  {@const edit =
    c.type === 'source' &&
    value &&
    !String(c.options.find(([v]) => v === value)?.[1]).endsWith('(missing)')}
  <div class={['opt', live.changed(g.file, c.ptr) && 'is-changed', edit && 'has-extra']}>
    <label class="tf__label" for="{uid}-{c.key}">
      {c.label}<i class="dot" title="Changed"></i>
    </label>
    {#if c.type === 'boolean'}
      <input
        id="{uid}-{c.key}"
        type="checkbox"
        class="switch"
        checked={!!value}
        onchange={(e) => setConfig(c, e.currentTarget.checked)}
      />
    {:else}
      <Select
        id="{uid}-{c.key}"
        value={value ?? ''}
        placeholder="Pick…"
        options={c.options.map(([v, label]) => ({ value: v, label }))}
        onchange={(v) => setConfig(c, v)}
      />
    {/if}
    {#if edit}
      <Button
        size="small"
        icon="pen-to-square"
        iconOnly
        label="Edit {baseName(`sources/${value}.json`)}"
        onclick={() => onsource(`sources/${value}.json`)}
      />
    {/if}
  </div>
{/snippet}

{#if options.length}
  <div class="opts">
    {#each options as c (c.key)}{@render option(c)}{/each}
  </div>
{/if}
{#each g.config?.filter((c) => c.type === 'text') ?? [] as c (c.key)}
  <Field
    edit="{g.file}#{c.ptr}"
    label={c.label}
    value={live.get(g.file, c.ptr)}
    changed={live.changed(g.file, c.ptr)}
    onvalue={(value) => setConfig(c, value)}
    binds={bindings ? bindings.binds('link') : null}
    names={bindings?.names ?? null}
    resolved={bindings?.resolved({ file: g.file, ptr: c.ptr, type: 'link' }) ?? ''}
  />
{/each}

{#each runsOf(g.fields) as run (run.list?.edit ?? run.fields[0].edit)}
  {#if run.fields}
    {@render rows(run.fields)}
  {:else}
    {@const f = run.list}
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
{/each}

<style lang="scss">
  .opts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .opt {
    position: relative;
    min-width: 0;
    padding: 4px;

    // the edit button sits beside the label, drawn at the right of the title row
    > :global(.btn) {
      position: absolute;
      top: 4px;
      right: 4px;
      height: 24px;
      margin: 0;
    }

    &.has-extra .tf__label {
      padding-right: 28px;
    }

    .tf__label {
      min-height: 24px;
    }

    .dot {
      display: none;
    }

    &.is-changed .dot {
      display: inline-block;
    }
  }
</style>
