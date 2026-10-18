<!--
  Add page (PagesList's +): a page in the folder shown, or its [slug] page (one page per item
  of a source, at /folder/<slug>/). Title, the name in its URL (from the title, unless typed),
  In the menu (the group's + picks it: Sub items on, Not linked off). Adding goes to disk at
  once (actions.pagesOp); In the menu adds its menu item (an undo step, saved with Save).
-->
<script>
  import { tick } from 'svelte';
  import { closeOnBackdrop } from '../lib/dialog.js';
  import Button from './Button.svelte';
  import Select from './Select.svelte';
  import { NAV, TEMPLATE, isSlug, pageFile, pageIdOf, sourceIds } from '../../site/files.js';
  import { pathOfId } from '../../site/routes.js';
  import { slugify } from '../../site/helpers.js';
  import { childId, linkPage } from '../lib/page-tree.js';

  // live: reactive store (live.svelte.js); actions: pagesOp (main.js)
  let { live, actions } = $props();

  const RESERVED = ['home', '404', 'edit', 'assets', 'media', 'sandbox'];
  const uid = $props.id();
  let dialog = $state();
  let level = $state('');
  let kind = $state('page'); // 'page' | 'template'
  let title = $state('');
  let name = $state('');
  let source = $state('');
  let linked = $state(true);
  let busy = $state(false);

  // the store's files, a new object per change (the store edits its own in place)
  const files = $derived((live.version, { ...live.store.current }));
  const ids = $derived(Object.keys(files).map(pageIdOf).filter(Boolean));
  const sources = $derived(sourceIds(files));
  const slug = $derived(name || slugify(title));
  const error = $derived(
    !slug
      ? ''
      : !isSlug(slug)
        ? 'Use a-z, 0-9 and dashes'
        : ids.includes(childId(level, slug))
          ? `${pathOfId(childId(level, slug))} already exists`
          : !level && RESERVED.includes(slug)
            ? `"${slug}" is reserved`
            : '',
  );
  // [slug] pages: in a page's folder (not the top, not 404), one per folder
  const noTemplate = $derived(
    !level
      ? 'Not at the top: add it in a page'
      : level === '404'
        ? 'Not in 404'
        : ids.includes(childId(level, TEMPLATE))
          ? `${pathOfId(level)} has its [slug] page`
          : '',
  );
  const ready = $derived(kind === 'page' ? !!slug && !error && !!title.trim() : !!source);

  /** Open it for folder `at` ('' = the top); `menu`: In the menu at the start. */
  export async function open({ level: at = '', linked: menu = true } = {}) {
    level = at;
    linked = menu;
    kind = 'page';
    title = name = '';
    source = sources[0] || '';
    dialog.showModal();
    await tick();
    dialog.querySelector('input')?.focus();
  }

  async function add(e) {
    e.preventDefault();
    if (!ready || busy) return;
    busy = true;
    const res = await actions.pagesOp(
      kind === 'page'
        ? { op: 'add', parent: level, name: slug, title: title.trim() }
        : { op: 'template', parent: level, source },
    );
    busy = false;
    if (!res) return;
    if (kind === 'page' && linked) {
      const pid = live.current(pageFile(res.id))?.id;
      const parent = level ? live.current(pageFile(level))?.id : null;
      const nav = linkPage(live.current(NAV) || {}, pid, title.trim(), parent);
      if (pid) live.store.set(NAV, '/header', nav.header, { source: 'panel', structure: true });
    }
    dialog.close();
  }
</script>

<dialog class="modal__box apm" aria-label="Add page" bind:this={dialog} {@attach closeOnBackdrop}>
  <form onsubmit={add}>
    <h3 class="modal__title">Add page</h3>
    <p class="hint small apm__where">In {pathOfId(level || 'home')}</p>

    <div class="seg" role="radiogroup" aria-label="Kind">
      <button
        type="button"
        role="radio"
        aria-checked={kind === 'page'}
        class={['seg__btn', kind === 'page' && 'is-active']}
        onclick={() => (kind = 'page')}>Page</button
      >
      <button
        type="button"
        role="radio"
        aria-checked={kind === 'template'}
        class={['seg__btn', kind === 'template' && 'is-active']}
        disabled={!!noTemplate}
        title={noTemplate || 'One page per item of a source'}
        onclick={() => (kind = 'template')}>[slug] page</button
      >
    </div>

    <!-- both kinds: the same height (three rows), so switching moves nothing -->
    <div class="apm__fields">
      {#if kind === 'page'}
        <label class="tf">
          <span class="tf__label">Title</span>
          <input class="tf__input" bind:value={title} placeholder="My page" />
        </label>
        <label class="tf">
          <span class="tf__label">Name in the URL</span>
          <input
            class={['tf__input', error && 'is-invalid']}
            spellcheck="false"
            bind:value={name}
            placeholder={slugify(title) || 'my-page'}
          />
        </label>
        <p class={['hint small apm__note', error && 'is-error']}>
          {error || (slug ? pathOfId(childId(level, slug)) : ' ')}
        </p>
        <label class="tf apm__menu">
          <span class="tf__label">
            In the menu
            <input type="checkbox" class="switch" role="switch" bind:checked={linked} />
          </span>
        </label>
      {:else}
        <div class="tf">
          <label class="tf__label" for="{uid}-source">Source</label>
          <Select
            id="{uid}-source"
            bind:value={source}
            options={sources.map((s) => ({ value: s, label: s, hint: `sources/${s}.json` }))}
          />
        </div>
        <p class="hint small apm__note">
          One page per item of {source || 'the source'}, at /{level}/&lt;slug&gt;/ (the item's slug,
          else its name). It is pinned last in Sub items.
        </p>
      {/if}
    </div>

    <footer class="modal__actions">
      <Button onclick={() => dialog.close()}>Cancel</Button>
      <Button type="submit" variant="primary" icon="plus" disabled={!ready || busy}>Add</Button>
    </footer>
  </form>
</dialog>

<style lang="scss">
  @use '../styles/mixins' as *;

  dialog.apm {
    width: min(400px, calc(100vw - 32px));
  }

  .apm form {
    @include stack(var(--space-3));
  }

  .apm .modal__title {
    margin: 0;
  }

  .apm__where {
    margin: calc(-1 * var(--space-2)) 0 0;
  }

  .apm__fields {
    @include stack(var(--space-3));
    align-content: start;
    min-height: 216px;

    .tf {
      margin: 0;
    }
  }

  .apm__note {
    min-height: 16px;
    margin: calc(-1 * var(--space-2)) 0 0;

    &.is-error {
      color: var(--c-danger);
    }
  }

  .apm .modal__actions {
    margin-top: 0;
  }
</style>
