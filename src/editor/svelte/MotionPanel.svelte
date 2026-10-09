<!--
  Motion tab. Nothing picked: the page-transition curtain (CurtainSection) and the page's
  animated elements. An element picked (ui.anim, from the preview or the list): its
  animation (AnimEditor).
-->
<script>
  import AnimEditor from './AnimEditor.svelte';
  import CurtainSection from './CurtainSection.svelte';
  import { ui } from './ui.svelte.js';
  import { ANIMATIONS } from '../../site/files.js';

  // live: reactive store (live.svelte.js); bridge: the preview (../bridge.js)
  let { live, bridge } = $props();

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
      <AnimEditor {live} {bridge} {cfg} {items} {gsap} />
    {/key}
  {:else}
    <CurtainSection {live} {bridge} {gsap} />
    <p class="hint">
      Click an animated element in the preview, or pick one below. Hold Alt to click through to
      links.
    </p>
    {#if items.length}
      <ol class="mlist__items">
        {#each items as { el, id, key } (key)}
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
              <span class="mlist__preset">
                {cfg.elements?.[key]?.preset || cfg.targets[id]?.preset || '?'}
              </span>
            </button>
          </li>
        {/each}
      </ol>
    {:else}
      <p class="hint">No animated elements on this page.</p>
    {/if}
  {/if}
</section>
