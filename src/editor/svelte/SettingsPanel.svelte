<!--
  Settings tab: what is the same on every page. The site's name and details
  (settings/site.json), its search and share defaults (SEO: titles, description, share image,
  address, robots, language; a page's own are in Content > SEO), smooth scrolling, the global page-transition curtain and the page
  fade (settings/animations.json), and where uploaded photos are served from (site.json mediaUrl).
  Per-page things stay in Content (texts, the curtain text) and Motion (the page's curtain:
  Global, Custom or Off, and its animations). The menus (settings/nav.json: links, order,
  dropdowns) are in Menu (MenuSettings.svelte), redirects.json in Redirects
  (RedirectSettings.svelte); Menu and Footer copy is also in Content: it is
  text you click in the preview.
-->
<script>
  import Field from './Field.svelte';
  import MenuSettings from './MenuSettings.svelte';
  import RedirectSettings from './RedirectSettings.svelte';
  import Section from './Section.svelte';
  import Select from './Select.svelte';
  import CurtainSection from './CurtainSection.svelte';
  import PageFadeSection from './PageFadeSection.svelte';
  import { ui } from './ui.svelte.js';
  import { SEO_SETTINGS, SITE_SETTINGS } from './content-groups.js';
  import { ANIMATIONS, SITE } from '../../site/files.js';

  // live: reactive store (live.svelte.js); bridge: the preview (../bridge.js)
  let { live, bridge } = $props();

  const uid = $props.id();

  // The preview's GSAP, for the ease curves.
  const gsap = $derived.by(() => {
    ui.previewVersion;
    return bridge.api?.gsap;
  });

  // animations.json "smoothScroll": missing means on. The preview switches at once.
  const smooth = $derived(live.get(ANIMATIONS, '/smoothScroll') !== false);
  const smoothChanged = $derived(live.changed(ANIMATIONS, '/smoothScroll'));
  const setSmooth = (on) => live.store.set(ANIMATIONS, '/smoothScroll', on, { source: 'panel' });

  function set(key, value) {
    live.store.set(SITE, `/${key}`, value, { key: `text:${SITE}#/${key}`, source: 'panel' });
  }
</script>

<section class="ed-body">
  <Section key="settings:site" title="Site" name="Name & details">
    <p class="hint">
      Used on every page: the footer, the clock and search engines' details about you. The preview
      shows them after Save.
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
  </Section>

  <Section key="settings:seo" title="Site" name="SEO">
    <p class="hint">
      What search engines and share cards show. Pages can set their own in Content > SEO; these are
      the defaults.
    </p>
    {#each SEO_SETTINGS as [key, label, type] (key)}
      <Field
        edit="{SITE}#/{key}"
        {label}
        {type}
        value={live.get(SITE, `/${key}`)}
        changed={live.changed(SITE, `/${key}`)}
        onvalue={(value) => set(key, value)}
      />
    {/each}
    <div class={['tf', live.changed(SITE, '/robots') && 'is-changed']}>
      <label class="tf__label" for="{uid}-robots"
        >Search engines<i class="dot" title="Changed"></i></label
      >
      <Select
        id="{uid}-robots"
        value={live.get(SITE, '/robots') || 'index'}
        options={[
          { value: 'index', label: 'Index the site' },
          { value: 'noindex', label: 'Keep the whole site out (noindex)' },
        ]}
        onchange={(value) => set('robots', value)}
      />
    </div>
  </Section>

  <MenuSettings {live} />

  <RedirectSettings {live} />

  <Section key="settings:media" title="Site" name="Photos">
    <p class="hint">
      Photos you upload in the editor go to Cloudflare R2 (keys in .env.local, see the README). The
      content stores their key (photos/…); the site shows them from this address. Photos in media/
      keep working.
    </p>
    <Field
      edit="{SITE}#/mediaUrl"
      label="Photo address (R2 public URL)"
      placeholder="https://photos.eeliyarasta.com"
      value={live.get(SITE, '/mediaUrl')}
      changed={live.changed(SITE, '/mediaUrl')}
      onvalue={(value) => set('mediaUrl', value.trim())}
    />
  </Section>

  <Section key="settings:scroll" title="Site" name="Scrolling">
    <label class={['tf', smoothChanged && 'is-changed']}>
      <span class="tf__label"
        >Smooth scroll<i class="dot" title="Changed"></i>
        <input
          type="checkbox"
          class="switch"
          aria-label="Smooth scroll"
          checked={smooth}
          onchange={(e) => setSmooth(e.currentTarget.checked)}
        />
      </span>
    </label>
    <p class="hint small">Eased scrolling with mouse and trackpad. Off: the browser's own.</p>
  </Section>

  {#if gsap}
    <CurtainSection {live} {bridge} {gsap} />
    <PageFadeSection {live} {gsap} />
  {:else}
    <p class="hint">Waiting for the preview…</p>
  {/if}
</section>
