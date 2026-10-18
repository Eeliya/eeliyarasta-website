<!--
  Content > SEO (a tab of the page panel), plain fields: its address (PageAddress.svelte:
  renames it), then what search engines and share cards say about the page in the preview, from
  its file's "meta" (src/site/seo.js). A page: title, description, share image, noindex and
  canonical. A [slug] page: its template's defaults for every item page (an item's own name,
  summary and cover come first). Below, a search result and a share card as the build makes
  them, with the character counts search engines show. Empty fields fall back to the site's
  defaults (Settings > SEO). Every change is one undo step; the preview's page itself does not
  change.
-->
<script>
  import Button from './Button.svelte';
  import Field from './Field.svelte';
  import PageAddress from './PageAddress.svelte';
  import { ui } from './ui.svelte.js';
  import { imageSrcset, imageUrl, media } from './media.svelte.js';
  import { DESCRIPTION_MAX, TITLE_MAX, seoOf } from '../../site/seo.js';
  import { TEMPLATE, contentFromFiles, pageIdOf } from '../../site/files.js';

  // live: reactive store (live.svelte.js); file: the page file of the preview
  // actions: pagesOp (main.js: the Address renames the page on disk)
  let { live, file, actions } = $props();

  const uid = $props.id();
  const template = $derived(!!pageIdOf(file)?.endsWith(TEMPLATE));

  // the preview's page as the build sees it, with the editor's changes
  const seo = $derived.by(() => {
    live.version;
    const route = live.routeOf(ui.path);
    if (!route) return null;
    const content = contentFromFiles(live.store.current);
    const ctx = { ...content, media: media.manifest, photos: media.photos };
    return { ...seoOf(ctx, route), src: route.image || content.site?.ogImage || '' };
  });
  const host = $derived(seo ? seo.url.replace(/^\w+:\/\//, '').replace(/\/$/, '') : '');

  const get = (key) => live.get(file, `/meta/${key}`);
  const changed = (key) => live.changed(file, `/meta/${key}`);
  // an empty value is removed: the page uses its default
  const set = (key, value) =>
    live.store.set(file, `/meta/${key}`, value === '' || value === false ? undefined : value, {
      key: `text:${file}#/meta/${key}`,
      source: 'panel',
    });
</script>

<div class="seo fields">
  <p class="hint">
    {template
      ? 'Defaults for every item page. Each item page is titled with its name and uses its own summary and cover first.'
      : 'Search engines and share cards. Empty fields use the site defaults (Settings > SEO).'}
  </p>
  <PageAddress {live} {file} {actions} />
  {#if !template}
    <Field
      edit="{file}#/meta/title"
      label="Title"
      placeholder="The page's heading"
      value={get('title')}
      changed={changed('title')}
      onvalue={(v) => set('title', v.trim())}
    />
  {/if}
  <Field
    edit="{file}#/meta/description"
    label={template ? 'Description (items without a summary)' : 'Description'}
    type="block"
    placeholder="The site's description"
    value={get('description')}
    changed={changed('description')}
    onvalue={(v) => set('description', v.trim())}
  />
  <Field
    edit="{file}#/meta/image"
    label={template ? 'Share image (items without a cover)' : 'Share image'}
    type="image"
    value={get('image')}
    changed={changed('image')}
    onvalue={(v) => set('image', v)}
  />
  {#if get('image')}
    <div class="seo__row">
      <Button size="small" icon="xmark" onclick={() => set('image', '')}>
        Use the site's share image
      </Button>
    </div>
  {/if}
  <label class={['tf', changed('noindex') && 'is-changed']}>
    <span class="tf__label"
      >{template ? 'Hide every item page from search' : 'Hide from search'}
      <input
        type="checkbox"
        class="switch"
        aria-label={template ? 'Hide every item page from search' : 'Hide from search'}
        checked={!!get('noindex')}
        onchange={(e) => set('noindex', e.currentTarget.checked)}
      />
    </span>
  </label>
  <p class="hint small">Noindex: search engines skip it and it leaves sitemap.xml.</p>
  {#if !template}
    <Field
      edit="{file}#/meta/canonical"
      label="Canonical URL (when this page copies another)"
      placeholder={seo?.url || ''}
      value={get('canonical')}
      changed={changed('canonical')}
      onvalue={(v) => set('canonical', v.trim())}
    />
  {/if}

  {#if seo}
    <h4 class="seo__head" id="{uid}-serp">Search result</h4>
    <div class="seo__serp" aria-labelledby="{uid}-serp">
      <span class="seo__url">{host.replaceAll('/', ' › ')}</span>
      <span class="seo__title">{seo.title}</span>
      <span class="seo__desc">{seo.description || 'No description'}</span>
    </div>
    <p class="hint small">
      Title <span class={[seo.title.length > TITLE_MAX && 'seo__over']}
        >{seo.title.length} / {TITLE_MAX}</span
      >
      · Description
      <span class={[seo.description.length > DESCRIPTION_MAX && 'seo__over']}
        >{seo.description.length} / {DESCRIPTION_MAX}</span
      >
      {#if seo.noindex}· <span class="seo__over">noindex: not in search</span>{/if}
    </p>
    <h4 class="seo__head" id="{uid}-card">Share card</h4>
    <div class="seo__card" aria-labelledby="{uid}-card">
      {#if seo.src}
        <img
          class="seo__img"
          src={imageUrl(seo.src)}
          srcset={imageSrcset(seo.src) || undefined}
          sizes="368px"
          alt=""
        />
      {/if}
      <span class="seo__domain">{host.split('/')[0]}</span>
      <span class="seo__title">{seo.title}</span>
      <span class="seo__desc">{seo.description}</span>
    </div>
  {/if}
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  .seo__row {
    display: flex;
    justify-content: flex-end;
    margin: -4px 0 var(--space-3);
  }

  .seo__head {
    margin: var(--space-4) 0 var(--space-2);
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    font-weight: 400;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  // a search result: address, title (one line), description (two lines)
  .seo__serp,
  .seo__card {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin-bottom: var(--space-2);
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: var(--c-surface-2);
  }

  .seo__url,
  .seo__domain {
    @include muted;
  }

  .seo__title {
    @include ellipsis;
    color: var(--c-link);
    font-size: var(--fs-md);
  }

  .seo__desc {
    display: -webkit-box;
    overflow: hidden;
    color: var(--c-text);
    font-size: var(--fs-base);
    line-height: 1.5;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  // a share card: the image (1.91:1, as most sites crop it) above the text
  .seo__card {
    padding: 0 0 var(--space-3);
    overflow: hidden;

    > :not(img) {
      padding: 0 var(--space-3);
    }
  }

  .seo__img {
    width: 100%;
    aspect-ratio: 1.91;
    margin-bottom: var(--space-2);
    object-fit: cover;
  }

  .seo__over {
    color: var(--c-notice);
  }
</style>
