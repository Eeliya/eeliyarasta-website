<!-- mock: the page's Content panel as tabs: Sections | Transitions | SEO -->
<script>
  import PageTabs from '../parts/PageTabs.svelte';
</script>

<div style="display: flex; gap: 24px; align-items: flex-start;">
  <PageTabs tab="sections" caption="Sections: the section cards, then the dashed Add section card" />
  <PageTabs tab="transitions" caption="Transitions: Backdrop and the page's curtain, plain fields under headings (no cards)" />
  <PageTabs tab="seo" caption="SEO: SeoSection's fields, plain, with the search preview" />
</div>
