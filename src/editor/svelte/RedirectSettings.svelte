<!--
  Settings > Redirects: content/settings/redirects.json (src/site/redirects.js), the old
  addresses that send visitors on, written to dist/_redirects by the build. Renaming or
  deleting a page in the Pages window, and changing an item's slug, add them by themselves;
  here they can be checked, changed, added and removed. Each: from (a path, or a pattern like
  /old/:slug/), to (a page of the site or an external URL) and its status. Every change is
  one undo step.
-->
<script>
  import Field from './Field.svelte';
  import ListField from './ListField.svelte';
  import Section from './Section.svelte';
  import Select from './Select.svelte';
  import { REDIRECTS } from '../../site/files.js';
  import { isExternal } from '../../site/helpers.js';
  import { buildRedirects, redirectsOf, sitePaths } from '../../site/redirects.js';

  // live: reactive store (live.svelte.js)
  let { live } = $props();

  const uid = $props.id();
  const EXTERNAL = '(external)';
  const STATUS = [
    { value: 301, label: 'Moved for good (301)' },
    { value: 302, label: 'Moved for now (302)' },
  ];

  const list = $derived.by(() => {
    live.version;
    // a copy: the store changes its objects in place, the list must look new to show it
    return structuredClone(redirectsOf(live.store.current));
  });
  // the site's pages and item patterns, for `to` and the warnings
  const paths = $derived.by(() => {
    live.version;
    return sitePaths(live.store.current);
  });
  const warnings = $derived(buildRedirects(list, paths).warnings);

  /** Change the list: fn gets a copy to change; one undo step. */
  function change(fn) {
    const next = structuredClone(list);
    fn(next);
    live.store.set(REDIRECTS, '', next, { source: 'panel' });
  }
  const setKey = (i, key, value) =>
    live.store.set(REDIRECTS, `/${i}/${key}`, value, {
      key: `text:${REDIRECTS}#/${i}/${key}`,
      source: 'panel',
    });

  const toOf = (r) => (isExternal(r.to) ? EXTERNAL : r.to);
  const toOptions = (r) => [
    ...[...paths].sort().map((p) => ({ value: p, label: p })),
    ...(!isExternal(r.to) && !paths.has(r.to) ? [{ value: r.to, label: `${r.to} (no page)` }] : []),
    { value: EXTERNAL, label: 'External URL' },
  ];
  const setTo = (i, value) => setKey(i, 'to', value === EXTERNAL ? 'https://' : value);
</script>

<Section key="settings:redirects" title="Site" name="Redirects" open={false}>
  <p class="hint">
    Old addresses that send visitors on (dist/_redirects, for Cloudflare Pages). Renaming or
    deleting a page and changing an item's slug add them by themselves. /old/:slug/ stands for every
    item page in a folder.
  </p>
  <ListField
    label="Redirects"
    items={list}
    name={(r) => `${r.from} → ${r.to}`}
    addLabel="Add redirect"
    onmove={(from, to) => change((l) => l.splice(to, 0, ...l.splice(from, 1)))}
    onremove={(i) => change((l) => l.splice(i, 1))}
    onadd={() => change((l) => l.push({ from: '/old/', to: '/' }))}
  >
    {#snippet item(r, i)}
      <Field
        edit="{REDIRECTS}#/{i}/from"
        label="From (a path on this site)"
        value={r.from}
        changed={live.changed(REDIRECTS, `/${i}/from`)}
        onvalue={(v) => setKey(i, 'from', v.trim())}
      />
      <div class={['tf', live.changed(REDIRECTS, `/${i}/to`) && 'is-changed']}>
        <label class="tf__label" for="{uid}-to-{i}">To<i class="dot" title="Changed"></i></label>
        <Select
          id="{uid}-to-{i}"
          value={toOf(r)}
          options={toOptions(r)}
          onchange={(v) => setTo(i, v)}
        />
      </div>
      {#if isExternal(r.to)}
        <Field
          edit="{REDIRECTS}#/{i}/to"
          label="URL"
          value={r.to}
          changed={live.changed(REDIRECTS, `/${i}/to`)}
          onvalue={(v) => setKey(i, 'to', v.trim())}
        />
      {/if}
      <div class={['tf', live.changed(REDIRECTS, `/${i}/status`) && 'is-changed']}>
        <label class="tf__label" for="{uid}-status-{i}"
          >Status<i class="dot" title="Changed"></i></label
        >
        <Select
          id="{uid}-status-{i}"
          value={r.status ?? 301}
          options={STATUS}
          onchange={(v) => setKey(i, 'status', v === 301 ? undefined : v)}
        />
      </div>
    {/snippet}
  </ListField>
  {#each warnings as w (w)}
    <p class="hint small redir__warn">{w}</p>
  {/each}
</Section>

<style lang="scss">
  .redir__warn {
    color: #f0a040;
  }
</style>
