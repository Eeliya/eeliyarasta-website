<!--
  Content tab: the page in the preview, or a site part (the Header: HeaderPart.svelte; the Footer). A page is a list of sections
  holding blocks (src/site/layout/), and nothing else. A page's panel has three tabs (Tabs.svelte,
  the open one kept per page in ui.sections["pagetab:<file>"]):
    Sections     SectionsList.svelte: the section cards and the dashed Add section card; a
                 block opens in BlockInspector.svelte (ui.block: its Content, Layout, Motion)
    Transitions  the Backdrop (BackdropFields.svelte) and the Curtain (PageCurtain.svelte)
    SEO          SeoSection.svelte
  The footer is sections only (no tabs). While this tab is open the preview is a
  layout canvas (overlay.js): a click picks a block, a drag moves it, its handles resize it and
  a double click edits a text in place (bridge.js); links and buttons don't follow; a click on
  empty space or Esc drops the selection. The selected block's section shows its grid (faint
  cells). The Sources button beside
  the page menu (App.svelte) opens the Source Explorer (SourcesModal.svelte); so does a
  list item's text clicked in the preview.

  Selection goes both ways through ui.selection: main.js sets it when a text is clicked in
  the preview, a field sets it (via the bridge) when it gets focus. This panel opens the block
  of that text, highlights its field and scrolls to it.
-->
<script>
  import { tick } from 'svelte';
  import { ui } from './ui.svelte.js';
  import HeaderPart from './HeaderPart.svelte';
  import BackdropFields from './BackdropFields.svelte';
  import PageCurtain from './PageCurtain.svelte';
  import Tabs from './Tabs.svelte';
  import BlockInspector from './BlockInspector.svelte';
  import SectionsList from './SectionsList.svelte';
  import SeoSection from './SeoSection.svelte';
  import SourcesModal from './SourcesModal.svelte';
  import { allFields, contentGroups, groupFor, splitEdit } from './content-groups.js';
  import { parse } from '../lib/pointer.js';
  import { targetFile } from '../layout-sync.js';
  import { sourceIdOf } from '../../site/files.js';

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
    return ui.target.id !== 'header' && !bridge.doc;
  });
  // the file whose sections are listed: the page's in the preview, or the footer's
  const file = $derived.by(() => {
    ui.previewVersion;
    return targetFile(ui.target, bridge.doc);
  });
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
  // a block open is in Sections: the row stays (nothing moves), another tab closes the block
  const shownTab = $derived(open ? 'sections' : tab);
  function pickTab(v) {
    if (open && v !== 'sections') ui.block = null;
    ui.sections[`pagetab:${file}`] = v;
  }
  const tabsId = $props.id();

  const onsource = (f, item, edit, then) => sourcesModal.open(f, item, edit, then);
  const itemOf = (f) => Number(parse(f.ptr)[0]) || 0; // a source field's item

  function openBlock(id) {
    ui.block = id;
    ui.blockTab = 'content';
  }

  /** Open the block holding `edit` and scroll to it (a Header label: its field); list items open the Sources modal. */
  async function reveal(edit) {
    await tick(); // not inside the effect below: the modal renders synchronously when opened
    const group = groups.find((g) => allFields(g).some((f) => f.edit === edit));
    if (!group) {
      const { file, ptr } = splitEdit(edit);
      // A list item shown on the home page (a person's name): edit it in the modal.
      if (groupFor(live.store, { file, ptr })?.id.startsWith('source:'))
        return sourcesModal.open(file, itemOf({ ptr }), edit);
    } else {
      if (isPage && tab !== 'sections') pickTab('sections');
      if (ui.block !== group.id || ui.blockTab !== 'content') openBlock(group.id);
    }
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

{#if isPage}
  <Tabs
    tabs={TABS}
    value={shownTab}
    onpick={pickTab}
    label="Page"
    class="page-tabs"
    id={tabsId}
    panel="{tabsId}-panel"
  />
{/if}
<section
  class="ed-body"
  bind:this={panel}
  id="{tabsId}-panel"
  role={isPage ? 'tabpanel' : undefined}
  aria-labelledby={isPage ? `${tabsId}-${shownTab}` : undefined}
>
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
    {:else if ui.target.id === 'header'}
      <HeaderPart {live} />
    {:else}
      <p class="hint">No editable content here.</p>
    {/if}
  {/if}

  <SourcesModal bind:this={sourcesModal} {live} {bridge} />
</section>

<style lang="scss">
  // the tabs' line runs the panel's full width, above the scrolling body
  :global(.page-tabs) {
    flex: none;
  }
</style>
