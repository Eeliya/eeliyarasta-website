<!--
  Content tab: the page in the preview (or the Menu / Footer). A page is a list of sections
  holding blocks (src/site/layout/): SectionsList.svelte lists them with their settings, and
  a block opens in BlockInspector.svelte (ui.block: its Content, Layout and Motion). Below the
  sections, the page's other texts (a [slug] page's shared labels, the curtain: groups from
  content-groups.js) and its SEO (SeoSection.svelte). Arrange turns on dragging and resizing
  blocks in the preview, Grid shows the sections' columns and rows (overlay.js). The Sources
  button opens the Source Explorer (SourcesModal.svelte); so does the file button (people.json)
  of a group whose texts come from one source, or beside a field when a group mixes.

  Selection goes both ways through ui.selection: main.js sets it when a text is clicked in
  the preview, a field sets it (via the bridge) when it gets focus. This panel opens the block
  (or group) of that text, highlights its field and scrolls to it.
-->
<script module>
  import { ui } from './ui.svelte.js';

  // Groups that start open; once toggled, the state is kept in ui.sections (Section.svelte).
  const OPEN = ['transition', 'nav', 'footer', 'page-body', 'content'];
  const keyOf = (g) => `text:${g.id}`;
  const isOpen = (g) => ui.sections[keyOf(g)] ?? OPEN.includes(g.id);
</script>

<script>
  import Button from './Button.svelte';
  import { tick } from 'svelte';
  import BlockInspector from './BlockInspector.svelte';
  import GroupFields from './GroupFields.svelte';
  import Section from './Section.svelte';
  import SectionsList from './SectionsList.svelte';
  import SeoSection from './SeoSection.svelte';
  import SourcesModal from './SourcesModal.svelte';
  import { allFields, contentGroups, groupFor, previewPage, splitEdit } from './content-groups.js';
  import { parse } from '../lib/pointer.js';
  import { previewFile } from '../layout-sync.js';
  import { baseName, sourceIdOf } from '../../site/files.js';

  // live: reactive store (live.svelte.js); bridge: the preview (../bridge.js);
  // actions: main.js (editMotion: open an element in the Motion tab)
  let { live, bridge, actions } = $props();

  let panel = $state();
  let sourcesModal = $state();

  // The texts come from the preview's [data-edit] elements: re-read them after every edit
  // (blocks may have moved) and when the preview shows another page.
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
  const others = $derived(groups.filter((g) => !g.block));
  const open = $derived(file && groups.find((g) => g.block && g.id === ui.block));
  // the files in content/sources/, for a list item's source
  const sourceIds = $derived.by(() => {
    live.version;
    return Object.keys(live.store.current).map(sourceIdOf).filter(Boolean).sort();
  });
  const hint = $derived(
    ui.target.kind === 'page'
      ? 'Click any outlined text in the preview to edit it in place, or open a block below. Arrange: drag blocks and their edges in the preview.'
      : ui.target.id === 'menu'
        ? 'Editing Menu labels. Changes show in the header and mobile menu of the preview.'
        : 'Editing Footer copy. Scroll the preview to the bottom to see changes.',
  );

  const onsource = (f, item, edit) => sourcesModal.open(f, item, edit);
  const itemOf = (f) => Number(parse(f.ptr)[0]) || 0; // a source field's item

  function openBlock(id) {
    ui.block = id;
    ui.blockTab = 'content';
  }

  /** Open the block or group holding `edit` and scroll to it; list items open the Sources modal. */
  async function reveal(edit) {
    await tick(); // not inside the effect below: the modal renders synchronously when opened
    const group = groups.find((g) => allFields(g).some((f) => f.edit === edit));
    if (!group) {
      const { file, ptr } = splitEdit(edit);
      // A list item shown on the home page (a person's name): edit it in the modal.
      if (groupFor(live.store, { file, ptr }, previewPage(bridge))?.id.startsWith('source:'))
        sourcesModal.open(file, itemOf({ ptr }), edit);
      return;
    }
    if (group.block) {
      if (ui.block !== group.id || ui.blockTab !== 'content') openBlock(group.id);
    } else ui.sections[keyOf(group)] = true;
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

<section class="ed-body" bind:this={panel}>
  <div class="tools">
    <Button
      size="small"
      icon="database"
      title="People, places, projects: the lists in content/sources/"
      onclick={() => sourcesModal.open()}
    >
      Sources
    </Button>
    {#if file}
      <Button
        size="small"
        icon="up-down-left-right"
        variant={ui.arrange ? 'primary' : 'default'}
        aria-pressed={ui.arrange}
        title="Drag blocks and their edges in the preview"
        onclick={() => actions.arrange(!ui.arrange)}
      >
        Arrange
      </Button>
      <Button
        size="small"
        icon="table-cells"
        variant={ui.grid ? 'primary' : 'default'}
        aria-pressed={ui.grid}
        title="Show the sections' columns and rows in the preview"
        onclick={() => actions.showGrid(!ui.grid)}
      >
        Grid
      </Button>
    {/if}
  </div>
  {#if waiting}
    <p class="hint">Waiting for the preview…</p>
  {:else if open}
    <BlockInspector
      g={open}
      {live}
      {bridge}
      {sourceIds}
      {onsource}
      onback={() => (ui.block = null)}
      onmotion={(el) => actions.editMotion(el)}
    />
  {:else}
    <p class="hint">{hint}</p>
    {#if file}<SectionsList {live} {file} onopen={openBlock} />{/if}
    {#each others as g (g.id)}
      <Section id={g.id} key={keyOf(g)} title={g.title} name={g.name} open={isOpen(g)}>
        {#snippet bar()}
          {#if g.source}
            {@const first = allFields(g)[0]}
            <Button
              size="small"
              variant="file"
              title="Edit in the Source Explorer: content/{g.source}"
              onclick={() => sourcesModal.open(g.source, itemOf(first), first.edit)}
            >
              {baseName(g.source)}
            </Button>
          {/if}
          <span class="count">{g.fields.length}</span>
        {/snippet}
        <GroupFields {g} {live} {bridge} {sourceIds} {onsource} />
      </Section>
    {:else}
      {#if !file}<p class="hint">No editable content here.</p>{/if}
    {/each}
    {#if file}<SeoSection {live} {file} />{/if}
  {/if}

  <SourcesModal bind:this={sourcesModal} {live} {bridge} />
</section>

<style lang="scss">
  .tools {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  .count {
    color: var(--faint);
    font-size: 10px;
    letter-spacing: 0;
  }
</style>
