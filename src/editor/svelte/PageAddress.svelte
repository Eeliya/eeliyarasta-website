<!--
  Content > SEO > Address: the page's URL. Its name (the last part) renames the page's folder,
  with every page in it, straight on disk (actions.pagesOp 'rename'): links to it and the
  redirects are updated, a redirect from the old address is added. Not for home or 404 (their
  address is fixed) or a [slug] page (its folder's address, then the item's slug).
-->
<script>
  import Button from './Button.svelte';
  import { isSlug, pageIdOf, TEMPLATE } from '../../site/files.js';
  import { parentId, pathOfId } from '../../site/routes.js';
  import { FIXED, childId, pageIds } from '../lib/page-tree.js';

  // live: reactive store; file: the page's file; actions: pagesOp (main.js)
  let { live, file, actions } = $props();

  const uid = $props.id();
  // the store's files, a new object per change (the store edits its own in place)
  const files = $derived((live.version, { ...live.store.current }));
  const id = $derived(pageIdOf(file));
  const fixed = $derived(FIXED.includes(id) || !!id?.endsWith(TEMPLATE));
  const name = $derived(id?.slice(id.lastIndexOf('/') + 1) || '');
  const folder = $derived(id ? pathOfId(parentId(id) || 'home') : '/');
  let draft = $state(null); // what is typed; null: the page's name
  let busy = $state(false);
  const value = $derived(draft ?? name);
  const error = $derived.by(() => {
    if (value === name) return '';
    if (!isSlug(value)) return 'Use a-z, 0-9 and dashes';
    const next = childId(parentId(id), value);
    if (pageIds(files).includes(next)) return `${pathOfId(next)} already exists`;
    return '';
  });

  async function rename(e) {
    e.preventDefault();
    if (value === name || error || busy) return;
    busy = true;
    const res = await actions.pagesOp({ op: 'rename', id, name: value });
    busy = false;
    if (res) draft = null;
  }
</script>

<form class="tf addr" onsubmit={rename}>
  <label class="tf__label" for="{uid}-name">Address</label>
  <div class="addr__row">
    <span class="addr__base" title={folder}>{fixed ? pathOfId(id) : folder}</span>
    {#if !fixed}
      <input
        id="{uid}-name"
        class={['tf__input', error && 'is-invalid']}
        spellcheck="false"
        {value}
        oninput={(e) => (draft = e.currentTarget.value)}
      />
      <Button
        type="submit"
        size="small"
        icon="pen"
        disabled={value === name || !!error || busy}
        label="Rename">Rename</Button
      >
    {/if}
  </div>
  <!-- one line, always: typing moves nothing -->
  <p class={['hint small addr__note', error && 'is-error']}>
    {fixed
      ? id?.endsWith(TEMPLATE)
        ? 'Item pages: the folder’s address, then the item’s slug.'
        : 'Fixed: this page’s address can’t change.'
      : error ||
        (value !== name
          ? `${pathOfId(id)} → ${pathOfId(childId(parentId(id), value))}: links follow, a redirect is added.`
          : 'Renames its folder and every page in it. Links follow.')}
  </p>
</form>

<style lang="scss">
  @use '../styles/mixins' as *;

  .addr {
    margin: 0;
  }

  // [ /photography/ | people______ | Rename ], 32px
  .addr__row {
    @include row(var(--space-2));
    min-height: 32px;

    .tf__input {
      flex: 1;
      min-width: 0;
      height: 32px;
      box-sizing: border-box;
    }
  }

  .addr__base {
    @include ellipsis;
    @include muted;
    flex: 0 1 auto;
    max-width: 50%;
    font-size: var(--fs-base);
  }

  .addr__note {
    @include ellipsis;
    margin: 0;

    &.is-error {
      color: var(--c-danger);
    }
  }
</style>
