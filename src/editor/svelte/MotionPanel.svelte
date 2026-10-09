<!--
  Motion tab, two sub-tabs (ui.library.open: Animations):
  Elements    nothing picked: the page's curtain (Global / Custom / Off, CurtainSection; the
              global curtain itself is in the Settings tab) and the page's animated elements.
              An element picked (ui.anim, from the preview or the list): its animation
              (AnimEditor).
  Animations  the library (AnimLibrary): every animation, edit one with the preview in view.
  Picking an element in the preview goes to Elements.
-->
<script>
  import AnimEditor from './AnimEditor.svelte';
  import AnimLibrary from './AnimLibrary.svelte';
  import CurtainSection from './CurtainSection.svelte';
  import Section from './Section.svelte';
  import { ui } from './ui.svelte.js';
  import { splitEdit } from './content-groups.js';
  import { getRoutes } from '../../site/routes.js';
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
</script>

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
      <AnimLibrary {live} {bridge} {cfg} {items} {gsap} />
    {:else if ui.anim}
      {#key ui.anim}
        <AnimEditor {live} {bridge} {cfg} {items} {gsap} onlibrary={openLibrary} />
      {/key}
    {:else}
      {#if page}<CurtainSection {live} {bridge} {gsap} {page} {onsettings} />{/if}
      <p class="hint">
        Click an animated element in the preview, or pick one below. Hold Alt to click through to
        links.
      </p>
      <Section key="motion:elements" title="This page" name="Elements">
        {#snippet bar()}<span class="mlist__count">{items.length}</span>{/snippet}
        {#if items.length}
          <ol class="list">
            {#each items as { el, id, key } (el)}
              <li>
                <button
                  type="button"
                  class="mlist__item"
                  onclick={() => {
                    bridge.reveal(el);
                    bridge.select(el, 'anim');
                  }}
                  onpointerenter={() => bridge.setHover(el)}
                  onpointerleave={() => bridge.setHover(null)}
                >
                  <span class="mlist__id">
                    {id}
                    {#if cfg.elements?.[key]}<i class="dot" title="Has element overrides"></i>{/if}
                  </span>
                  <span class="muted">
                    {cfg.elements?.[key]?.preset || cfg.targets[id]?.preset || '?'}
                  </span>
                </button>
              </li>
            {/each}
          </ol>
        {:else}
          <p class="hint">No animated elements on this page.</p>
        {/if}
      </Section>
    {/if}
  {/if}
</section>

<style lang="scss">
  // Elements | Animations, above everything else in the tab
  .mtabs {
    margin-bottom: 16px;
  }

  .mlist__count {
    color: var(--muted);
    font-size: 10.5px;
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
    border-radius: 12px;
    cursor: pointer;
    text-align: left;
    background: rgb(255 255 255 / 0.03);
    box-shadow: inset 0 0 0 1px var(--line);

    &:hover {
      background: rgb(255 255 255 / 0.08);
    }
  }
</style>
