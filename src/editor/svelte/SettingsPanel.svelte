<!--
  Settings tab: what is the same on every page. Where contact forms send (Forms), the site's
  name and details
  (settings/site.json), its search and share defaults (SEO: titles, description, share image,
  address, robots, language; a page's own are in Content > SEO), the global page-transition curtain and the page
  fade (settings/animations.json), where uploaded photos are served from (site.json mediaUrl)
  and the text styles scaled text uses (Typography: site.json typography, in cells,
  src/site/layout/type.js; the preview follows them as they are typed).
  Per-page things stay in Content (sections, the backdrop and curtain, SEO) and Motion (its
  animations); the header's menu and labels are the Header site part in Content
  (HeaderPart.svelte). redirects.json is in Redirects (RedirectSettings.svelte).
-->
<script>
  import Field from './Field.svelte';
  import RedirectSettings from './RedirectSettings.svelte';
  import Section from './Section.svelte';
  import Select from './Select.svelte';
  import CurtainSection from './CurtainSection.svelte';
  import PageFadeSection from './PageFadeSection.svelte';
  import { ui } from './ui.svelte.js';
  import { SEO_SETTINGS, SITE_SETTINGS } from './content-groups.js';
  import { TARGETS } from '../../site/widgets/form/index.js';
  import { SITE } from '../../site/files.js';
  import { COLS, MCOLS } from '../../site/layout/grid.js';
  import { TEXT_STYLES, typographyOf } from '../../site/layout/type.js';
  import {
    CONTAINED,
    CONTAINED_MIN,
    containedOf,
    containedWidth,
  } from '../../site/layout/contain.js';

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

  const TYPE_FIELDS = [
    ['size', 'Size (cells)'],
    ['min', 'Minimum (px)'],
    ['line', 'Line height (× size)'],
    ['tracking', 'Tracking (em)'],
  ];
  const typography = $derived.by(() => {
    live.version;
    return typographyOf(live.get(SITE, '') || {});
  });
  // the preview's scaled text follows the styles as they are typed (the page's head has them
  // after Save)
  $effect(() => {
    ui.previewVersion;
    const root = bridge.doc?.documentElement;
    if (!root) return;
    for (const [k, t] of Object.entries(typography)) {
      root.style.setProperty(`--ts-${k}`, t.size);
      root.style.setProperty(`--ts-${k}-lh`, t.line);
      root.style.setProperty(`--ts-${k}-tr`, `${t.tracking}em`);
      root.style.setProperty(`--ts-${k}-min`, `${t.min}px`);
    }
  });
  // Layout: a contained section's columns (layout/contain.js), its width at common windows
  const contained = $derived.by(() => {
    live.version;
    return containedOf(live.get(SITE, '') || {});
  });
  const WINDOWS = [1280, 1366, 1440, 1536, 1920];
  // the preview follows as it is typed (the page's head has it after Save)
  $effect(() => {
    ui.previewVersion;
    bridge.doc?.documentElement.style.setProperty('--contain', String(contained));
  });
  function setContained(value) {
    if (!Number.isInteger(value) || value < CONTAINED_MIN || value > COLS) return;
    set('layout/containedCols', value);
  }

  function setStyle(k, key, value) {
    if (typeof value !== 'number' || (key !== 'tracking' && value <= 0)) return;
    set(`typography/${k}/${key}`, value);
  }
</script>

<section class="ed-body">
  <Section key="settings:site" title="Name & details">
    <p class="hint">
      Used on every page: the clock and search engines' details about you. The preview shows them
      after Save.
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

  <Section key="settings:seo" title="SEO">
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
      <label class="tf__label" for="{uid}-robots">Search engines</label>
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

  <Section key="settings:forms" title="Forms">
    <p class="hint">
      Where contact forms send (a form can pick its own in Content). The Cloudflare function emails
      through Resend with the keys set in the Cloudflare Pages project, never here (see the README,
      "Contact form"). In npm run dev it only logs the message.
    </p>
    <div class={['tf', live.changed(SITE, '/forms/target') && 'is-changed']}>
      <label class="tf__label" for="{uid}-forms">Forms send to</label>
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

  <Section key="settings:layout" title="Layout">
    <p class="hint">
      How wide a contained section is: columns of the {COLS}-column grid ({CONTAINED_MIN}–{COLS};
      {CONTAINED} by default), centred and never nearer the edges than the side margins. Its widgets keep
      their columns: they scale with it. Phones: the full width inside the margins.
    </p>
    <div class="fields">
      <Field
        edit="{SITE}#/layout/containedCols"
        label="Contained width (columns)"
        type="number"
        value={contained}
        changed={live.changed(SITE, '/layout/containedCols')}
        onvalue={setContained}
      />
    </div>
    <ul class="widths" aria-label="Contained width at common window sizes">
      {#each WINDOWS as w (w)}
        <li><span>{w}</span><strong>{Math.round(containedWidth(w, contained))} px</strong></li>
      {/each}
    </ul>
  </Section>

  <Section key="settings:type" title="Typography">
    <p class="hint">
      The text styles of scaled text (a text widget's Layout › Scale text), in cells of the
      {COLS}-column grid (~11px at 1440px wide; on phones half a {MCOLS}-column cell), so the text
      grows and shrinks with the page. Text that doesn't scale keeps its normal size.
    </p>
    {#each Object.entries(TEXT_STYLES) as [k, style] (k)}
      <p class="tf__label">{style.label}</p>
      <div class="fields">
        {#each TYPE_FIELDS as [key, label] (key)}
          <Field
            edit="{SITE}#/typography/{k}/{key}"
            {label}
            type="number"
            half
            value={typography[k][key]}
            changed={live.changed(SITE, `/typography/${k}/${key}`)}
            onvalue={(value) => setStyle(k, key, value)}
          />
        {/each}
      </div>
    {/each}
  </Section>

  <RedirectSettings {live} />

  <Section key="settings:media" title="Photos">
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

<style lang="scss">
  @use '../styles/mixins' as *;

  // the contained width at each window size: window | px
  .widths {
    @include stack(var(--space-1));
    margin: var(--space-3) 0 0;
    padding: 0;
    @include muted;
    list-style: none;

    li {
      display: flex;
      justify-content: space-between;
    }

    strong {
      color: var(--c-text);
      font-weight: 400;
    }
  }
</style>
