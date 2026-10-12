<!--
  Settings > Menu: the menus of content/en/settings/nav.json (src/site/templates/header.js), a
  Section each: Header (the nav pill and the mobile menu) and Footer (its Index column).
  Each item: its label, its link (a page of the site, or an external URL), and in the header
  a dropdown: links one level deep, or the items of a source. Every change is one undo step;
  the preview renders the menu again.
-->
<script>
  import Field from './Field.svelte';
  import LinkField from './LinkField.svelte';
  import ListField from './ListField.svelte';
  import Section from './Section.svelte';
  import Select from './Select.svelte';
  import { ui } from './ui.svelte.js';
  import { NAV, sourceIdOf } from '../../site/files.js';

  // live: reactive store (live.svelte.js)
  let { live } = $props();

  const uid = $props.id();

  const MENUS = [
    ['header', 'Header', 'The nav at the top and the mobile menu. An item can open a dropdown.'],
    ['footer', 'Footer', 'The links of the Index column in the footer.'],
  ];

  // the sources a dropdown can list
  const sources = $derived.by(() => {
    live.version;
    return Object.keys(live.store.current).map(sourceIdOf).filter(Boolean).sort();
  });

  const listOf = (menu) => {
    const list = live.get(NAV, `/${menu}`);
    return Array.isArray(list) ? list : [];
  };

  /** Change a menu: fn gets a copy of the list to change; one undo step, the preview renders it. */
  function change(menu, fn) {
    const list = structuredClone(listOf(menu));
    fn(list);
    live.store.set(NAV, `/${menu}`, list, { source: 'panel', structure: true });
  }

  /** The item at path (indexes: [i] or [i, j] for a dropdown link) in list. */
  const at = (list, path) => (path.length === 1 ? list[path[0]] : list[path[0]].children[path[1]]);
  /** The list holding the item at path. */
  const siblings = (list, path) => (path.length === 1 ? list : list[path[0]].children);
  const ptrOf = (menu, path, key) =>
    `/${menu}/${path[0]}${path.length > 1 ? `/children/${path[1]}` : ''}/${key}`;

  const move = (menu, path, to) =>
    change(menu, (list) => {
      const sib = siblings(list, path);
      sib.splice(to, 0, ...sib.splice(path.at(-1), 1));
    });
  const remove = (menu, path) =>
    change(menu, (list) => siblings(list, path).splice(path.at(-1), 1));
  const add = (menu, path) =>
    change(menu, (list) => {
      const home = ui.pages.find((p) => p.path === '/')?.pid;
      const item = { label: 'New link', ...(home ? { page: home } : { href: '/' }) };
      if (path.length) (list[path[0]].children ||= []).push(item);
      else list.push(item);
    });

  /** A menu item's link: { page } | { item } | { href } (src/site/hrefs.js), in place. */
  function setLink(menu, path, link) {
    change(menu, (list) => {
      const item = at(list, path);
      delete item.page;
      delete item.item;
      delete item.href;
      Object.assign(item, link);
    });
  }

  /** A dropdown's list: '' none, else the source whose items it lists. */
  const setItems = (menu, path, value) =>
    change(menu, (list) => {
      const item = at(list, path);
      if (value) item.items = value;
      else delete item.items;
    });

  /**
   * A label or URL as typed (one undo step while typing). A label the preview updates itself;
   * a URL renders the menu again (once the typing pauses, main.js pushDraft).
   */
  function setText(menu, path, key, value) {
    const ptr = ptrOf(menu, path, key);
    const structure = key === 'href';
    live.store.set(NAV, ptr, value, { key: `text:${NAV}#${ptr}`, source: 'panel', structure });
  }

  const nameOf = (item) => item.label || '(no label)';
</script>

<!-- a Select with its label, changed dot on the label -->
{#snippet select(id, label, value, options, changed, onchange)}
  <div class={['tf', changed && 'is-changed']}>
    <label class="tf__label" for={id}>{label}<i class="dot" title="Changed"></i></label>
    <Select {id} {value} {options} placeholder="Pick…" {onchange} />
  </div>
{/snippet}

<!-- one menu item's fields (entry); path: [i] or [i, j]; header items get a dropdown (top level only links) -->
{#snippet fields(menu, entry, path)}
  {@const id = `${uid}-${menu}-${path.join('-')}`}
  {@const ptr = (key) => ptrOf(menu, path, key)}
  <Field
    edit="{NAV}#{ptr('label')}"
    label="Label"
    value={entry.label}
    changed={live.changed(NAV, ptr('label'))}
    onvalue={(v) => setText(menu, path, 'label', v)}
  />
  <LinkField
    {live}
    edit="{NAV}#{ptr('page')}"
    value={entry}
    changed={['page', 'item', 'href'].some((k) => live.changed(NAV, ptr(k)))}
    onvalue={(link) => setLink(menu, path, link)}
  />
  {#if menu === 'header' && !entry.children?.length}
    {@render select(
      `${id}-items`,
      path.length === 1 ? 'Dropdown: the items of' : 'Lists the items of',
      entry.items ?? '',
      [{ value: '', label: 'None' }, ...sources.map((s) => ({ value: s, label: `${s}.json` }))],
      live.changed(NAV, ptr('items')),
      (v) => setItems(menu, path, v),
    )}
  {/if}
  {#if menu === 'header' && path.length === 1 && (entry.items || entry.children?.length)}
    <Field
      edit="{NAV}#{ptr('all')}"
      label="Link to the page at the end of the dropdown (empty: none)"
      value={entry.all ?? ''}
      changed={live.changed(NAV, ptr('all'))}
      onvalue={(v) => setText(menu, path, 'all', v)}
    />
  {/if}
  {#if menu === 'header' && path.length === 1 && !entry.items}
    <ListField
      label="Dropdown links"
      items={entry.children || []}
      name={nameOf}
      addLabel="Add dropdown link"
      onmove={(from, to) => move(menu, [path[0], from], to)}
      onremove={(j) => remove(menu, [path[0], j])}
      onadd={() => add(menu, path)}
    >
      {#snippet item(child, j)}{@render fields(menu, child, [path[0], j])}{/snippet}
    </ListField>
  {/if}
{/snippet}

{#each MENUS as [menu, title, hint] (menu)}
  <Section key="settings:menu-{menu}" title="Menu" name={title} open={false}>
    <p class="hint">{hint}</p>
    <ListField
      label="{title} links"
      items={listOf(menu)}
      name={nameOf}
      addLabel="Add link"
      onmove={(from, to) => move(menu, [from], to)}
      onremove={(i) => remove(menu, [i])}
      onadd={() => add(menu, [])}
    >
      {#snippet item(it, i)}{@render fields(menu, it, [i])}{/snippet}
    </ListField>
  </Section>
{/each}
