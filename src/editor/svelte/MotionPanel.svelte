<!--
  Motion tab. Nothing picked: the page's curtain (Global / Custom / Off, CurtainSection; the
  global curtain itself is in the Settings tab) and the page's animated elements (Elements).
  An element picked (ui.anim, from the preview or the list): its animation (AnimEditor).
-->
<script>
  import AnimEditor from './AnimEditor.svelte';
  import AnimationsModal from './AnimationsModal.svelte';
  import CurtainSection from './CurtainSection.svelte';
  import Section from './Section.svelte';
  import { ui } from './ui.svelte.js';
  import { splitEdit } from './content-groups.js';
  import { getRoutes } from '../../site/routes.js';
  import { ANIMATIONS, contentFromFiles } from '../../site/files.js';

  // live: reactive store (live.svelte.js); bridge: the preview (../bridge.js);
  // onsettings: switch to the Settings tab
  let { live, bridge, onsettings } = $props();

  let library = $state();

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
  {:else if ui.anim}
    {#key ui.anim}
      <AnimEditor {live} {bridge} {cfg} {items} {gsap} onlibrary={(name) => library.open(name)} />
    {/key}
  {:else}
    <button
      type="button"
      class="btn-sm lib-open"
      title="The animations elements use: their own durations, eases, distances, ..."
      onclick={() => library.open()}
    >
      <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> Animations
    </button>
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
  {#if gsap}<AnimationsModal bind:this={library} {live} {bridge} {cfg} {items} {gsap} />{/if}
</section>

<style lang="scss">
  // the Animations library button, above the curtain (like Sources in the Content tab)
  .lib-open {
    margin-bottom: 12px;
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
    gap: 10px;
    padding: 9px 12px;
    border: 0;
    border-radius: 10px;
    cursor: pointer;
    text-align: left;
    background: rgb(255 255 255 / 0.03);
    box-shadow: inset 0 0 0 1px var(--line);

    &:hover {
      background: rgb(255 255 255 / 0.08);
    }
  }
</style>
