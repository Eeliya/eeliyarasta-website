<!--
  Content tab: the page in the preview, or a site part (the Header: HeaderPart.svelte; the Footer). A page is a list of sections
  holding blocks (src/site/layout/), and nothing else. A page's panel has three tabs (Tabs.svelte,
  the open one kept per page in ui.sections["pagetab:<file>"]):
    Sections     SectionsList.svelte: the section cards and the dashed Add section card. One
                 level under it, never both: a block's settings (BlockInspector.svelte,
                 ui.block: its Content, Layout, Motion; a block's row on a card, or the block
                 clicked in the preview) or a section's (SectionView.svelte, ui.section; a
                 card's pen or double click). The Add block modal (BlocksModal.svelte): the
                 block added opens
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
  import { tick, untrack } from 'svelte';
  import { gsap } from 'gsap';
  import { ui } from './ui.svelte.js';
  import HeaderPart from './HeaderPart.svelte';
  import BackdropFields from './BackdropFields.svelte';
  import PageCurtain from './PageCurtain.svelte';
  import Tabs from './Tabs.svelte';
  import BlockInspector from './BlockInspector.svelte';
  import BlocksModal from './BlocksModal.svelte';
  import SectionView from './SectionView.svelte';
  import SectionsList from './SectionsList.svelte';
  import SeoSection from './SeoSection.svelte';
  import SourcesModal from './SourcesModal.svelte';
  import { allFields, contentGroups, groupFor } from './content-groups.js';
  import { splitEdit } from '../../site/helpers.js';
  import { parse } from '../lib/pointer.js';
  import { targetFile } from '../layout-sync.js';
  import { TEMPLATE, pageIdOf, sourceIds as sourceIdsOf } from '../../site/files.js';
  import { BLOCK_TYPES } from '../../site/blocks/index.js';
  import { addBlock } from '../layout-ops.js';

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
  const sections = $derived.by(() => {
    live.version;
    const list = file && live.current(file)?.sections;
    return Array.isArray(list) ? list : [];
  });
  // what the Sections tab shows over the list: the block open, else a section's settings
  // ({ section: its id }); none: the list (a block or section gone, e.g. undone: the list too)
  const open = $derived(
    (file && groups.find((g) => g.block && g.id === ui.block)) ||
      (!ui.block && ui.section && sections.some((s) => s?.id === ui.section)
        ? { section: ui.section }
        : null),
  );
  // the files in content/en/sources/, for a list item's source
  const sourceIds = $derived.by(() => {
    live.version;
    return sourceIdsOf(live.store.current);
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
    if (open && v !== 'sections') back();
    ui.sections[`pagetab:${file}`] = v;
  }
  const tabsId = $props.id();

  const onsource = (f, item, edit, then) => sourcesModal.open(f, item, edit, then);
  const itemOf = (f) => Number(parse(f.ptr)[0]) || 0; // a source field's item

  function openBlock(id) {
    ui.section = null;
    ui.block = id;
    ui.blockTab = 'content';
  }
  // a section card's pen or double click: its settings
  function openSection(id) {
    ui.block = null;
    ui.selection = null;
    ui.section = id;
  }
  function back() {
    ui.block = null;
    ui.section = null;
  }

  // Add block (a section card's): the types on offer (item types,
  // the item of a [slug] page, only there); the block added opens
  let blocksModal = $state();
  const types = $derived(
    Object.values(BLOCK_TYPES)
      .filter((t) => !t.item || pageIdOf(file)?.endsWith(TEMPLATE))
      .map(({ type, label, icon, line, sketch }) => ({ value: type, label, icon, line, sketch })),
  );
  const addTo = (at, type) => openBlock(addBlock(live.store, file, at, type).id);

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

  // Sections: the list and the block view side by side in a clipping wrapper. Opening a block
  // slides the list out to the left and the block in from the right (Back: the reverse), the
  // wrapper's height eased between them; the list's scroll comes back on Back. Block to block
  // swaps in place; a new slide kills a running one; reduced motion: instant.
  let held = $state(null); // the block shown, kept while it slides out
  let moving = $state(false); // both panes shown (a slide)
  let slideEl = $state();
  let listEl = $state();
  let blockEl = $state();
  let tl = null;
  let saved = 0; // the list's scroll
  const atBlock = $derived(!!open);
  $effect(() => {
    if (open) held = open;
  });
  let first = true;
  $effect(() => {
    const to = atBlock;
    untrack(() => slide(to));
  });

  async function slide(to) {
    if (first) return void (first = false);
    const settled = !moving;
    tl?.kill();
    tl = null;
    if (to && settled && panel) saved = panel.scrollTop;
    if (!slideEl || matchMedia('(prefers-reduced-motion: reduce)').matches) return done(to);
    const from = slideEl.offsetHeight;
    moving = true;
    await tick();
    if (!listEl || !blockEl || atBlock !== to) return to === atBlock && done(to);
    const w = slideEl.clientWidth;
    if (settled) {
      gsap.set(listEl, { x: to ? 0 : -w, y: -saved });
      gsap.set(blockEl, { x: to ? w : 0 });
      panel.scrollTop = 0;
    }
    const target = (to ? blockEl : listEl).offsetHeight;
    tl = gsap
      .timeline({ defaults: { duration: 0.35, ease: 'power2.out' }, onComplete: () => done(to) })
      .to(listEl, { x: to ? -w : 0 }, 0)
      .to(blockEl, { x: to ? 0 : w }, 0)
      .fromTo(slideEl, { height: from }, { height: target }, 0);
  }

  async function done(to) {
    tl = null;
    moving = false;
    if (!to) held = null;
    for (const el of [slideEl, listEl, blockEl]) if (el) gsap.set(el, { clearProps: 'all' });
    await tick();
    if (panel) panel.scrollTop = to ? 0 : saved;
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
  {:else if file && shownTab === 'sections'}
    <div class="slide" bind:this={slideEl}>
      <div
        class={['slide__pane', atBlock && !moving && 'is-away']}
        bind:this={listEl}
        inert={atBlock}
      >
        <SectionsList
          {live}
          {file}
          onopen={openBlock}
          onsection={openSection}
          onadd={(at) => blocksModal.open(at)}
        />
      </div>
      {#if held}
        <div class="slide__pane" bind:this={blockEl} inert={!atBlock}>
          {#if held.section}
            <SectionView {live} {bridge} {file} id={held.section} onback={back} />
          {:else}
            <BlockInspector
              g={held}
              {live}
              {bridge}
              {sourceIds}
              {onsource}
              onback={back}
              onmotion={(el) => actions.editMotion(el)}
              onlibrary={(name) => {
                ui.library = { open: true, name };
                actions.setMode('motion');
              }}
            />
          {/if}
        </div>
      {/if}
    </div>
  {:else}
    {#if isPage && tab === 'transitions'}
      <BackdropFields {live} {file} />
      <hr class="pane__line" />
      <PageCurtain {live} onsettings={() => actions.setMode('settings')} />
    {:else if isPage && tab === 'seo'}
      <SeoSection {live} {file} />
    {:else if ui.target.id === 'header'}
      <HeaderPart {live} />
    {:else}
      <p class="hint">No editable content here.</p>
    {/if}
  {/if}

  <SourcesModal bind:this={sourcesModal} {live} {bridge} />
  <BlocksModal bind:this={blocksModal} {types} onpick={(type, at) => addTo(at, type)} />
</section>

<style lang="scss">
  // the tabs' line runs the panel's full width, above the scrolling body
  :global(.page-tabs) {
    flex: none;
    padding: var(--space-3) var(--space-1) 0; // 4px + a tab's 12px: its label on the 16px edge
  }

  // the panes share one cell; the cards' -8px margins stay inside the clip
  .slide {
    display: grid;
    flex: none;
    margin-inline: -8px;
    padding-inline: 8px;
    overflow: clip;
  }

  .slide__pane {
    display: flex;
    grid-area: 1 / 1;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
    align-self: start;

    &.is-away {
      display: none;
    }
  }
</style>
