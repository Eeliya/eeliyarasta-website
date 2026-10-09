<!--
  Motion tab. Nothing picked: the page's animated elements (the global page-transition
  curtain is in the Settings tab). An element picked (ui.anim, from the preview or the list): its
  animation (AnimEditor).
-->
<script>
  import AnimEditor from './AnimEditor.svelte';
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
    <p class="hint">
      Click an animated element in the preview, or pick one below. Hold Alt to click through to
      links.
    </p>
    {#if items.length}
      <ol class="list">
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
  {/if}
</section>

<style lang="scss">
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
