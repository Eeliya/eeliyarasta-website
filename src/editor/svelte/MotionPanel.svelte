<!--
  Motion tab, two sub-tabs (ui.library.open: Animations):
  Elements    nothing picked: the page's curtain (Global / Custom / Off, CurtainSection; the
              global curtain itself is in the Settings tab), then the page's blocks, a box per
              section, each with its animation and its parts that have their own (data-anim
              inside it: the hero's photos, a heading's title, ...), then the animated elements
              outside the blocks (the footer).
              A block picked (ui.anim.block, from the preview or the list): its motion
              (BlockMotion). A part or element picked: its animation (AnimEditor).
  Animations  the library (AnimLibrary): every animation, edit one with the preview in view.
  Picking in the preview goes to Elements; the block picked is the Content tab's block too.
-->
<script>
  import AnimEditor from './AnimEditor.svelte';
  import AnimLibrary from './AnimLibrary.svelte';
  import BlockMotion from './BlockMotion.svelte';
  import Button from './Button.svelte';
  import CurtainSection from './CurtainSection.svelte';
  import Section from './Section.svelte';
  import { ui } from './ui.svelte.js';
  import { nameOf, splitEdit } from './content-groups.js';
  import { previewFile } from '../layout-sync.js';
  import { getRoutes } from '../../site/routes.js';
  import { BLOCK_TYPES } from '../../site/blocks/index.js';
  import { ANIMATIONS, contentFromFiles } from '../../site/files.js';

  // live: reactive store (live.svelte.js); bridge: the preview (../bridge.js);
  // onsettings: switch to the Settings tab
  let { live, bridge, onsettings } = $props();

  const TABS = [
    [false, 'Elements'],
    [true, 'Animations'],
  ];
  /** Open the Animations sub-tab, on animation `name` ('' = the list). */
  function openLibrary(name = '') {
    ui.library = { open: true, name };
  }

  // A new pick (preview click or the list) shows it: back to Elements.
  let picked = ui.anim;
  $effect(() => {
    if (ui.anim && ui.anim !== picked) ui.library.open = false;
    picked = ui.anim;
  });

  // Where the previewed page's "transition" is stored ({ file, ptr }), null on other URLs.
  const page = $derived.by(() => {
    ui.previewVersion;
    live.version;
    const path = bridge.path();
    const route = getRoutes(contentFromFiles(live.store.current)).find((r) => r.path === path);
    return route ? splitEdit(route.transitionEdit) : null;
  });

  const cfg = $derived(live.current(ANIMATIONS));
  // The preview's GSAP and animated elements: re-read when it shows another page.
  const gsap = $derived.by(() => {
    ui.previewVersion;
    return bridge.api?.gsap;
  });
  const items = $derived.by(() => {
    ui.previewVersion;
    live.version;
    return bridge.api ? bridge.animElements() : [];
  });

  // The page's sections and blocks (its file), each block with its element and parts.
  const file = $derived.by(() => {
    ui.previewVersion;
    return previewFile(bridge.doc);
  });
  const sections = $derived.by(() => {
    ui.previewVersion;
    live.version;
    const list = file ? live.get(file, '/sections') : null;
    if (!Array.isArray(list) || !bridge.doc) return [];
    return list.map((s, at) => ({
      id: s.id,
      at,
      name: (s.blocks || []).map(nameOf).find(Boolean) || '',
      blocks: (s.blocks || []).map((b, j) => {
        const el = bridge.doc.querySelector(`[data-block="${CSS.escape(b.id)}"]`);
        return {
          id: b.id,
          j,
          el,
          label: BLOCK_TYPES[b.type]?.label || b.type,
          name: nameOf(b),
          anim: b.motion?.anim || '',
          parts: el ? items.filter((it) => it.el.closest('[data-block]') === el) : [],
        };
      }),
    }));
  });
  const outside = $derived(items.filter((it) => !it.el.closest('[data-block]')));
  // the block picked, where it is
  const picks = $derived.by(() => {
    const id = ui.anim?.block;
    for (const s of sections) for (const b of s.blocks) if (b.id === id) return { s, b };
    return null;
  });

  /** Pick an element or block (as a click in the preview does). */
  function pick(el) {
    if (!el) return;
    bridge.reveal(el);
    bridge.select(el, 'anim');
  }
</script>

{#snippet part({ el, id, key })}
  <li>
    <button
      type="button"
      class="mlist__item mlist__part"
      onclick={() => pick(el)}
      onpointerenter={() => bridge.setHover(el)}
      onpointerleave={() => bridge.setHover(null)}
    >
      <span class="mlist__id">
        {id}
        {#if cfg.elements?.[key]}<i class="dot" title="Has element overrides"></i>{/if}
      </span>
      <span class="muted">{cfg.elements?.[key]?.preset || cfg.targets[id]?.preset || '?'}</span>
    </button>
  </li>
{/snippet}

<section class="ed-body">
  {#if !gsap}
    <p class="hint">Waiting for the preview…</p>
  {:else}
    <div class="seg mtabs" role="tablist" aria-label="Motion">
      {#each TABS as [lib, label] (label)}
        <button
          type="button"
          role="tab"
          aria-selected={ui.library.open === lib}
          class={['seg__btn', ui.library.open === lib && 'is-active']}
          onclick={() => (ui.library.open = lib)}>{label}</button
        >
      {/each}
    </div>
    {#if ui.library.open}
      <AnimLibrary {live} {bridge} {cfg} {items} {sections} {gsap} />
    {:else if picks}
      {#key ui.anim}
        <div class="msel__head">
          <Button size="small" icon="arrow-left" onclick={() => bridge.select(null)}
            >Elements</Button
          >
          <h3 class="msel__title">{picks.b.label}</h3>
          <span class="muted"
            >Section {picks.s.at + 1}{picks.b.name ? ` · ${picks.b.name}` : ''}</span
          >
        </div>
        <BlockMotion
          {live}
          {bridge}
          {gsap}
          {cfg}
          {file}
          at={picks.s.at}
          j={picks.b.j}
          el={picks.b.el}
          onlibrary={openLibrary}
          onpart={pick}
        />
      {/key}
    {:else if ui.anim && !ui.anim.block}
      {#key ui.anim}
        <AnimEditor {live} {bridge} {cfg} {items} {gsap} onlibrary={openLibrary} />
      {/key}
    {:else}
      {#if page}<CurtainSection {live} {bridge} {gsap} {page} {onsettings} />{/if}
      <p class="hint">
        Click a block or an animated part of it in the preview, or pick one below. Hold Alt to click
        through to links.
      </p>
      {#each sections as s (s.id)}
        <Section key="motion:{s.id}" title="Section {s.at + 1}" name={s.name}>
          <ol class="list">
            {#each s.blocks as b (b.id)}
              <li>
                <button
                  type="button"
                  class="mlist__item"
                  data-block-item={b.id}
                  disabled={!b.el}
                  onclick={() => pick(b.el)}
                  onpointerenter={() => bridge.setHover(b.el)}
                  onpointerleave={() => bridge.setHover(null)}
                >
                  <span class="mlist__id">{b.label}{b.name ? ` · ${b.name}` : ''}</span>
                  <span class="muted">{b.anim || 'none'}</span>
                </button>
                {#if b.parts.length}
                  <ol class="list mlist__parts">
                    {#each b.parts as p (p.el)}{@render part(p)}{/each}
                  </ol>
                {/if}
              </li>
            {/each}
          </ol>
        </Section>
      {/each}
      {#if outside.length}
        <Section key="motion:elements" title="Outside the blocks" name="Footer and fixed parts">
          {#snippet bar()}<span class="mlist__count">{outside.length}</span>{/snippet}
          <ol class="list">
            {#each outside as it (it.el)}{@render part(it)}{/each}
          </ol>
        </Section>
      {/if}
    {/if}
  {/if}
</section>

<style lang="scss">
  // Elements | Animations, above everything else in the tab
  .mtabs {
    margin-bottom: 16px;
  }

  .msel__head {
    display: grid;
    gap: 4px;
    margin-bottom: 12px;
    justify-items: start;
  }

  .msel__title {
    margin: 8px 0 0;
    font-family: var(--f-display);
    font-weight: 400;
    font-size: var(--fs-3xl);
    line-height: 1;
  }

  // a block's parts, under it
  .mlist__parts {
    margin: 4px 0 0 16px;
  }

  .mlist__part {
    font-size: var(--fs-sm);
  }

  .mlist__count {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }

  // motion panel
  .mlist__item {
    width: 100%;
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 12px;
    line-height: 16px; // 32px tall
    border: 0;
    border-radius: var(--radius-lg);
    cursor: pointer;
    text-align: left;
    background: var(--c-fill-hover);
    box-shadow: inset 0 0 0 1px var(--c-line);

    &:hover {
      background: var(--c-fill-active);
    }
  }
</style>
