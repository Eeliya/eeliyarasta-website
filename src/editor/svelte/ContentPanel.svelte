<!--
  Content tab: the page in the preview (or the Menu / Footer). A page is a list of sections
  holding blocks (src/site/layout/), and nothing else. A page's panel has three tabs (Tabs.svelte,
  the open one kept per page in ui.sections["pagetab:<file>"]):
    Sections     SectionsList.svelte: the section cards and the dashed Add section card; a
                 block opens in BlockInspector.svelte (ui.block: its Content, Layout, Motion)
    Transitions  the Backdrop (BackdropFields.svelte) and the Curtain (PageCurtain.svelte)
    SEO          SeoSection.svelte
  The footer is sections only; the Menu its labels (groups from content-groups.js). While this tab is open the preview is a
  layout canvas (overlay.js): a click picks a block, a drag moves it, its handles resize it and
  a double click edits a text in place (bridge.js); links and buttons don't follow; a click on
  empty space or Esc drops the selection. The selected block's section shows its grid (faint
  cells). The Sources button beside
  the page menu (App.svelte) opens the Source Explorer (SourcesModal.svelte); so does the file
  button (people.json) of a group whose texts come from one source, or beside a field when a
  group mixes.

  Selection goes both ways through ui.selection: main.js sets it when a text is clicked in
  the preview, a field sets it (via the bridge) when it gets focus. This panel opens the block
  (or group) of that text, highlights its field and scrolls to it.
-->
<script module>
  import { ui } from './ui.svelte.js';

  // Groups that start open; once toggled, the state is kept in ui.sections (Section.svelte).
  const OPEN = ['nav'];
  const keyOf = (g) => `text:${g.id}`;
  const isOpen = (g) => ui.sections[keyOf(g)] ?? OPEN.includes(g.id);
</script>

<script>
  import Button from './Button.svelte';
  import { tick } from 'svelte';
  import BackdropFields from './BackdropFields.svelte';
  import PageCurtain from './PageCurtain.svelte';
  import Tabs from './Tabs.svelte';
  import BlockInspector from './BlockInspector.svelte';
  import GroupFields from './GroupFields.svelte';
  import Section from './Section.svelte';
  import SectionsList from './SectionsList.svelte';
  import SeoSection from './SeoSection.svelte';
  import SourcesModal from './SourcesModal.svelte';
  import { allFields, contentGroups, groupFor, splitEdit } from './content-groups.js';
  import { parse } from '../lib/pointer.js';
  import { targetFile } from '../layout-sync.js';
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
    return ui.target.id !== 'menu' && !bridge.doc;
  });
  // the file whose sections are listed: the page's in the preview, or the footer's
  const file = $derived.by(() => {
    ui.previewVersion;
    return targetFile(ui.target, bridge.doc);
  });
  const others = $derived(groups.filter((g) => !g.block));
  const open = $derived(file && groups.find((g) => g.block && g.id === ui.block));
  // the files in content/en/sources/, for a list item's source
  const sourceIds = $derived.by(() => {
    live.version;
    return Object.keys(live.store.current).map(sourceIdOf).filter(Boolean).sort();
  });

  // a page's tabs, the open one per page file
  const TABS = [
    ['sections', 'Sections'],
    ['transitions', 'Transitions'],
    ['seo', 'SEO'],
  ];
  const isPage = $derived(!!file && ui.target.kind === 'page');
  const tab = $derived((isPage && ui.sections[`pagetab:${file}`]) || 'sections');
  const pickTab = (v) => (ui.sections[`pagetab:${file}`] = v);

  const onsource = (f, item, edit, then) => sourcesModal.open(f, item, edit, then);
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
      if (groupFor(live.store, { file, ptr })?.id.startsWith('source:'))
        sourcesModal.open(file, itemOf({ ptr }), edit);
      return;
    }
    if (group.block) {
      if (isPage && tab !== 'sections') pickTab('sections');
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

{#if isPage && !open}
  <Tabs tabs={TABS} value={tab} onpick={pickTab} label="Page" class="page-tabs" />
{/if}
<section class="ed-body" bind:this={panel}>
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
      onlibrary={(name) => {
        ui.library = { open: true, name };
        actions.setMode('motion');
      }}
    />
  {:else}
    {#if isPage && tab === 'transitions'}
      <BackdropFields {live} {file} />
      <hr class="pane__line" />
      <PageCurtain {live} onsettings={() => actions.setMode('settings')} />
    {:else if isPage && tab === 'seo'}
      <SeoSection {live} {file} />
    {:else if file}
      <SectionsList {live} {bridge} {file} onopen={openBlock} />
    {/if}
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
  {/if}

  <SourcesModal bind:this={sourcesModal} {live} {bridge} />
</section>

<style lang="scss">
  // the tabs' line runs the panel's full width, above the scrolling body
  :global(.page-tabs) {
    flex: none;
  }

  .count {
    color: var(--c-text-faint);
    font-size: var(--fs-xs);
    letter-spacing: 0;
  }
</style>
