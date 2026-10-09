<!--
  Settings tab: what is the same on every page. The site's name, title and meta
  (settings/site.json) and the global page-transition curtain (settings/animations.json).
  Per-page things stay in Content (texts, the curtain text) and Motion (the page's curtain:
  Global, Custom or Off, and its animations). Menu and Footer copy stays in Content: it is
  text you click in the preview.
-->
<script>
  import Field from './Field.svelte';
  import CurtainSection from './CurtainSection.svelte';
  import { ui } from './ui.svelte.js';
  import { SITE_SETTINGS } from './content-groups.js';
  import { SITE } from '../../site/files.js';

  // live: reactive store (live.svelte.js); bridge: the preview (../bridge.js)
  let { live, bridge } = $props();

  // The preview's GSAP, for the ease curves.
  const gsap = $derived.by(() => {
    ui.previewVersion;
    return bridge.api?.gsap;
  });

  function set(key, value) {
    live.store.set(SITE, `/${key}`, value, { key: `text:${SITE}#/${key}`, source: 'panel' });
  }
</script>

<section class="ed-body">
  <section class="grp">
    <h4 class="grp__title">Site</h4>
    <p class="hint">
      Used on every page: page titles, meta tags and the footer. The preview shows them after Save.
    </p>
    {#each SITE_SETTINGS as [key, label, type] (key)}
      <Field
        edit="{SITE}#/{key}"
        {label}
        {type}
        value={live.get(SITE, `/${key}`)}
        changed={live.changed(SITE, `/${key}`)}
        onvalue={(value) => set(key, value)}
      />
    {/each}
  </section>

  {#if gsap}
    <CurtainSection {live} {bridge} {gsap} />
  {:else}
    <p class="hint">Waiting for the preview…</p>
  {/if}
</section>
