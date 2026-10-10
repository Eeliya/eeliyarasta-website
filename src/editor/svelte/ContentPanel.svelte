<!--
  Content tab: every editable text of the page in the preview (or of the Menu / Footer),
  grouped by section (content-groups.js decides which texts and groups). A page is a list of
  sections (src/site/sections/): each can be moved, duplicated, deleted, turned on/off and
  configured (its type's config: source, layout, ...); Add section picks a type from the
  registry. Below them, the page's SEO (SeoSection.svelte). The Sources button on top opens
  the Source Explorer (SourcesModal.svelte).

  Selection goes both ways through ui.selection: main.js sets it when a text is clicked in
  the preview, a field sets it (via the bridge) when it gets focus. This panel highlights
  that field and scrolls to it.
-->
<script module>
  import { ui } from './ui.svelte.js';

  // Groups that start open; page sections ("s0", "s1", ...) do too. Once toggled, the
  // state is kept in ui.sections under the group's key (Section.svelte).
  const OPEN = ['transition', 'nav', 'footer', 'page-body', 'content'];
  const keyOf = (g) => g.key || `text:${g.id}`;
  const isOpen = (g) => ui.sections[keyOf(g)] ?? (OPEN.includes(g.id) || g.index !== undefined);
</script>

<script>
  import Button from './Button.svelte';
  import { tick } from 'svelte';
  import Field from './Field.svelte';
  import ListField from './ListField.svelte';
  import Section from './Section.svelte';
  import SeoSection from './SeoSection.svelte';
  import Select from './Select.svelte';
  import SourcesModal from './SourcesModal.svelte';
  import {
    allFields,
    contentGroups,
    groupFor,
    isSource,
    previewPage,
    sectionsOf,
    splitEdit,
  } from './content-groups.js';
  import { parse } from '../lib/pointer.js';
  import { previewFile } from '../sections.js';
  import { openMedia } from './media.svelte.js';
  import { addSection, duplicateSection, moveSection, removeSection } from '../section-ops.js';
  import { SECTION_TYPES } from '../../site/sections/index.js';
  import { TEMPLATE, baseName, pageIdOf, sourceIdOf } from '../../site/files.js';

  const uid = $props.id();

  // live: reactive store (live.svelte.js); bridge: the preview (../bridge.js)
  let { live, bridge } = $props();

  let panel = $state();
  let sourcesModal = $state();
  let deleting = $state(''); // "<file>#<index>": the section asking "Delete?"

  // The texts come from the preview's [data-edit] elements: re-read them after every edit
  // (sections may have moved) and when the preview shows another page.
  const groups = $derived.by(() => {
    live.version;
    ui.previewVersion;
    return contentGroups(live.store, bridge, ui.target);
  });
  const waiting = $derived.by(() => {
    ui.previewVersion;
    return ui.target.kind === 'page' && !bridge.doc;
  });
  // the page file of the preview, whose sections are listed
  const file = $derived.by(() => {
    ui.previewVersion;
    return ui.target.kind === 'page' ? previewFile(bridge.doc) : '';
  });
  const count = $derived.by(() => {
    live.version;
    return sectionsOf(live.store, file).length;
  });
  // the types Add section offers: item types (the item of a [slug] page) only there
  const types = $derived(
    Object.values(SECTION_TYPES).filter((t) => !t.item || pageIdOf(file)?.endsWith(TEMPLATE)),
  );
  // the files in content/sources/, for a list item's source
  const sourceIds = $derived.by(() => {
    live.version;
    return Object.keys(live.store.current).map(sourceIdOf).filter(Boolean).sort();
  });
  const hint = $derived(
    ui.target.kind === 'page'
      ? 'Click any outlined text in the preview to edit it in place, or use the fields below. Turn a section Off to hide it on the public page.'
      : ui.target.id === 'menu'
        ? 'Editing Menu labels. Changes show in the header and mobile menu of the preview.'
        : 'Editing Footer copy. Scroll the preview to the bottom to see changes.',
  );

  const isOn = (g) => !g.toggle || live.get(g.toggle.file, g.toggle.ptr) !== false;
  // A missing flag counts as on.
  const toggleChanged = (g) =>
    (live.get(g.toggle.file, g.toggle.ptr) ?? true) !==
    (live.getBase(g.toggle.file, g.toggle.ptr) ?? true);

  function setOn(g, on) {
    live.store.set(g.toggle.file, g.toggle.ptr, on, { key: `section:${g.id}`, source: 'panel' });
  }

  /**
   * Run a section list change; open/closed follows the sections, not the positions.
   * order(indexes): the old index at each new position (undefined for a new section).
   */
  async function change(op, order) {
    const key = (i) => `text:${file}#s${i}`;
    const was = Array.from({ length: count }, (_, i) => isOpen({ key: key(i), index: i }));
    deleting = '';
    op();
    order([...was.keys()]).forEach((old, i) => (ui.sections[key(i)] = was[old] ?? true));
    await tick();
  }

  /** Move section `g` up (dir -1) or down (1), keeping the focus on its button. */
  async function move(g, dir) {
    const i = g.index;
    const j = i + dir;
    await change(
      () => moveSection(live.store, file, i, j),
      (o) => (([o[i], o[j]] = [o[j], o[i]]), o),
    );
    const moved = panel.querySelector(`[data-section="s${j}"]`);
    const button = moved?.querySelector(`[data-dir="${dir < 0 ? 'up' : 'down'}"]`);
    (button?.disabled ? moved.querySelector('.sec__toggle') : button)?.focus();
  }

  const duplicate = (g) =>
    change(
      () => duplicateSection(live.store, file, g.index),
      (o) => (o.splice(g.index + 1, 0, g.index), o),
    );

  const remove = (g) =>
    change(
      () => removeSection(live.store, file, g.index),
      (o) => (o.splice(g.index, 1), o),
    );

  async function add(type) {
    const at = count;
    await change(
      () => addSection(live.store, file, type),
      (o) => [...o, undefined],
    );
    const added = panel.querySelector(`[data-section="s${at}"]`);
    added?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    added?.querySelector('.sec__toggle')?.focus();
  }

  function askDelete(g) {
    deleting = `${file}#${g.index}`;
    ui.sections[keyOf(g)] = true;
  }

  // on/off and layout the preview applies itself; other settings render the section again
  const LIVE_CONFIG = ['enabled', 'layout'];

  function setConfig(g, c, value) {
    live.store.set(g.file, c.ptr, value, {
      key: `config:${g.file}${c.ptr}`,
      source: 'panel',
      structure: !LIVE_CONFIG.includes(c.key),
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

  function setText(f, value) {
    live.store.set(f.file, f.ptr, value, { key: `text:${f.edit}`, source: 'panel' });
  }

  /** Open the group holding `edit` and scroll to it; list items open the Sources modal. */
  async function reveal(edit) {
    await tick(); // not inside the effect below: the modal renders synchronously when opened
    const group = groups.find((g) => allFields(g).some((f) => f.edit === edit));
    if (!group) {
      const { file, ptr } = splitEdit(edit);
      // A list item shown on the home page (a person's name): edit it in the modal.
      if (groupFor(live.store, { file, ptr }, previewPage(bridge))?.id.startsWith('source:'))
        sourcesModal.open(file, Number(parse(ptr)[0]) || 0, edit);
      return;
    }
    ui.sections[keyOf(group)] = true;
    await tick();
    panel
      .querySelector(`[data-edit="${CSS.escape(edit)}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  $effect(() => {
    const { edit, quiet } = ui.selection || {};
    if (edit && !quiet) reveal(edit);
  });
</script>

<!-- one field: a text / photo Field, or a source Select (a list item's source) -->
{#snippet field(f)}
  {#if f.type === 'source'}
    {@const value = live.get(f.file, f.ptr)}
    <div class={['sec__opt', live.changed(f.file, f.ptr) && 'is-changed']}>
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
  {:else if f.type === 'select'}
    {@const value = live.get(f.file, f.ptr)}
    <div class={['sec__opt', live.changed(f.file, f.ptr) && 'is-changed']}>
      <label class="tf__label" for="{uid}-{f.edit}"
        >{f.label}<i class="dot" title="Changed"></i></label
      >
      <Select
        id="{uid}-{f.edit}"
        value={value ?? ''}
        placeholder="Pick…"
        options={f.options.map(([v, label]) => ({ value: v, label }))}
        onchange={(v) => live.store.set(f.file, f.ptr, v, { source: 'panel', structure: true })}
      />
    </div>
  {:else if f.type === 'boolean'}
    <label class={['tf', live.changed(f.file, f.ptr) && 'is-changed']}>
      <span class="tf__label"
        >{f.label}<i class="dot" title="Changed"></i>
        <input
          type="checkbox"
          class="switch"
          aria-label={f.label}
          checked={!!live.get(f.file, f.ptr)}
          onchange={(e) =>
            live.store.set(f.file, f.ptr, e.currentTarget.checked, {
              source: 'panel',
              structure: true,
            })}
        />
      </span>
    </label>
  {:else}
    <Field
      {...f}
      value={live.get(f.file, f.ptr)}
      changed={live.changed(f.file, f.ptr)}
      selected={ui.selection?.edit === f.edit}
      source={isSource(f.file) ? f.file : ''}
      onsource={() => sourcesModal.open(f.file, Number(parse(f.ptr)[0]) || 0, f.edit)}
      onfocus={() => bridge.focusEdit(f.edit)}
      onvalue={(value) => setText(f, value)}
    />
  {/if}
{/snippet}

<!-- opens the Source Explorer at a source file -->
{#snippet editButton(file)}
  <Button
    size="small"
    icon="pen-to-square"
    iconOnly
    label="Edit {baseName(file)}"
    onclick={() => sourcesModal.open(file)}
  />
{/snippet}

<!-- a section setting (config): a Select (source, select) or a switch (boolean), labelled;
     a source has an edit button beside it -->
{#snippet option(g, c)}
  {@const value = live.get(g.file, c.ptr)}
  {@const edit =
    c.type === 'source' &&
    value &&
    !String(c.options.find(([v]) => v === value)?.[1]).endsWith('(missing)')}
  <div class={['sec__opt', live.changed(g.file, c.ptr) && 'is-changed', edit && 'has-extra']}>
    <label class="tf__label" for="{uid}-{g.index}-{c.key}">
      {c.label}<i class="dot" title="Changed"></i>
    </label>
    {#if c.type === 'boolean'}
      <input
        id="{uid}-{g.index}-{c.key}"
        type="checkbox"
        class="switch"
        checked={!!value}
        onchange={(e) => setConfig(g, c, e.currentTarget.checked)}
      />
    {:else}
      <Select
        id="{uid}-{g.index}-{c.key}"
        value={value ?? ''}
        placeholder="Pick…"
        options={c.options.map(([v, label]) => ({ value: v, label }))}
        onchange={(v) => setConfig(g, c, v)}
      />
    {/if}
    {#if edit}{@render editButton(`sources/${value}.json`)}{/if}
  </div>
{/snippet}

<section class="ed-body" bind:this={panel}>
  <Button
    size="small"
    icon="database"
    title="People, places, projects: the lists in content/sources/"
    onclick={() => sourcesModal.open()}
  >
    Sources
  </Button>
  {#if waiting}
    <p class="hint">Waiting for the preview…</p>
  {:else}
    <p class="hint">{hint}</p>
    {#each groups as g (g.key || g.id)}
      <Section
        id={g.id}
        key={keyOf(g)}
        icon={g.icon}
        title={g.title}
        name={g.name}
        open={isOpen(g)}
        off={!isOn(g)}
      >
        {#snippet bar()}
          {#if !g.toggle}<span class="sec__count">{g.fields.length}</span>{/if}
          {#if g.index !== undefined}
            <Button
              size="small"
              icon="arrow-up"
              iconOnly
              label="Move up: {g.title}"
              data-dir="up"
              disabled={g.index === 0}
              onclick={() => move(g, -1)}
            />
            <Button
              size="small"
              icon="arrow-down"
              iconOnly
              label="Move down: {g.title}"
              data-dir="down"
              disabled={g.index === count - 1}
              onclick={() => move(g, 1)}
            />
            <Button
              size="small"
              icon="copy"
              iconOnly
              label="Duplicate: {g.title}"
              onclick={() => duplicate(g)}
            />
            <Button
              size="small"
              icon="trash"
              iconOnly
              label="Delete: {g.title}"
              onclick={() => askDelete(g)}
            />
          {/if}
          {#if g.toggle}
            {#if toggleChanged(g)}<i class="dot" title="Changed"></i>{/if}
            <!-- on/off switch: a checkbox drawn by CSS (.switch, editor.scss) -->
            <input
              type="checkbox"
              class="switch"
              aria-label="Show {g.title}"
              title={isOn(g) ? 'Section is visible' : 'Section is hidden on the public page'}
              checked={isOn(g)}
              onchange={(e) => setOn(g, e.currentTarget.checked)}
            />
          {/if}
        {/snippet}

        {#if deleting === `${file}#${g.index}`}
          <div class="sec__confirm" role="group" aria-label="Delete {g.title}?">
            <span>Delete this section?</span>
            <Button size="small" variant="danger" icon="trash" onclick={() => remove(g)}>
              Delete
            </Button>
            <Button size="small" onclick={() => (deleting = '')}>Cancel</Button>
          </div>
        {/if}

        {#if g.config?.some((c) => c.options || c.type === 'boolean')}
          <div class="sec__opts">
            {#each g.config.filter((c) => c.options || c.type === 'boolean') as c (c.key)}
              {@render option(g, c)}
            {/each}
          </div>
        {/if}
        {#each g.config?.filter((c) => c.type === 'text') ?? [] as c (c.key)}
          <Field
            edit="{g.file}#{c.ptr}"
            label={c.label}
            value={live.get(g.file, c.ptr)}
            changed={live.changed(g.file, c.ptr)}
            onvalue={(value) => setConfig(g, c, value)}
          />
        {/each}
        {#if ui.staleSections.includes(g.index)}
          <p class="hint small">Updating the preview…</p>
        {/if}

        {#each g.fields as f (f.edit)}
          {#if f.list}
            <ListField
              label={f.label}
              items={f.items}
              addLabel={f.photo === null ? 'Add' : 'Add photo'}
              onmove={(from, to) => moveItem(f, from, to)}
              onremove={(i) => removeItem(f, i)}
              onadd={() => addItem(f)}
            >
              {#snippet item(fields)}
                {#each fields as sub (sub.edit)}{@render field(sub)}{/each}
              {/snippet}
            </ListField>
          {:else}
            {@render field(f)}
          {/if}
        {:else}
          {#if !g.config?.length}
            <p class="hint small">
              {isOn(g)
                ? 'No text fields in this section.'
                : 'Section is off. Turn it on to show it on the page.'}
            </p>
          {/if}
        {/each}
      </Section>
    {:else}
      <p class="hint">No editable content here.</p>
    {/each}

    {#if file}
      <div class="sec__add">
        <Select
          aria-label="Add section"
          value={null}
          placeholder="Add section…"
          options={types.map((t) => ({ value: t.type, label: t.label, icon: t.icon }))}
          onchange={(type) => add(type)}
        >
          {#snippet option(o)}
            <i class="fa-solid fa-{o.icon} sec__type" aria-hidden="true"></i>{o.label}
          {/snippet}
        </Select>
      </div>
      <SeoSection {live} {file} />
    {/if}
  {/if}

  <SourcesModal bind:this={sourcesModal} {live} {bridge} />
</section>

<style lang="scss">
  .sec__count {
    color: var(--faint);
    font-size: 10px;
    letter-spacing: 0;
  }

  .sec__opts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .sec__opt {
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

    .dot {
      display: none;
    }

    &.is-changed .dot {
      display: inline-block;
    }
  }

  .sec__confirm {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;

    span {
      flex: 1;
    }
  }

  .sec__add {
    padding-top: 12px;
    border-top: 1px solid var(--line);
  }

  .sec__type {
    width: 16px;
    color: var(--solid-faint);
    text-align: center;
  }

  .sec__opt .tf__label {
    min-height: 24px;
  }

  // the Source Explorer button, above the hint
  .ed-body > :global(.btn) {
    margin-bottom: 12px;
  }
</style>
