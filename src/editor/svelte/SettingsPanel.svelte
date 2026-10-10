<!--
  Settings tab: what is the same on every page. Where contact forms send (Forms), the site's
  name and details
  (settings/site.json), its search and share defaults (SEO: titles, description, share image,
  address, robots, language; a page's own are in Content > SEO), the global page-transition curtain and the page
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
  import { TARGETS } from '../../site/sections/form.js';
  import { ANIMATIONS, SITE } from '../../site/files.js';

  // live: reactive store (live.svelte.js); bridge: the preview (../bridge.js)
  let { live, bridge } = $props();

  const uid = $props.id();

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

  <Section key="settings:forms" title="Site" name="Forms">
    <p class="hint">
      Where contact forms send (a form can pick its own in Content). The Cloudflare function emails
      through Resend with the keys set in the Cloudflare Pages project, never here (see the README,
      "Contact form"). In npm run dev it only logs the message.
    </p>
    <div class={['tf', live.changed(SITE, '/forms/target') && 'is-changed']}>
      <label class="tf__label" for="{uid}-forms"
        >Forms send to<i class="dot" title="Changed"></i></label
      >
      <Select
        id="{uid}-forms"
        value={live.get(SITE, '/forms/target') || 'function'}
        options={TARGETS.map(([value, label]) => ({ value, label }))}
        onchange={(value) => set('forms/target', value)}
      />
    </div>
    <Field
      edit="{SITE}#/forms/endpoint"
      label="External endpoint (https://…, e.g. Formspree)"
      placeholder="https://formspree.io/f/…"
      value={live.get(SITE, '/forms/endpoint')}
      changed={live.changed(SITE, '/forms/endpoint')}
      onvalue={(value) => set('forms/endpoint', value.trim() || undefined)}
    />
    <Field
      edit="{SITE}#/forms/turnstileSiteKey"
      label="Turnstile site key (optional spam check; empty: off)"
      value={live.get(SITE, '/forms/turnstileSiteKey')}
      changed={live.changed(SITE, '/forms/turnstileSiteKey')}
      onvalue={(value) => set('forms/turnstileSiteKey', value.trim() || undefined)}
    />
    <p class="hint small">
      Email link: the visitor's mail app, to the site email ({live.get(SITE, '/email') ||
        'not set'}).
    </p>
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

  {#if gsap}
    <CurtainSection {live} {bridge} {gsap} />
    <PageFadeSection {live} {gsap} />
  {:else}
    <p class="hint">Waiting for the preview…</p>
  {/if}
</section>
