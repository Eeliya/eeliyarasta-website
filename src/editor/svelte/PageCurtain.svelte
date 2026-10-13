<!--
  Content > Transitions: the page's curtain, plain fields under a "Curtain" heading. Global (the
  site's curtain, its timing in Settings) or Off (no curtain when you navigate here: a fade),
  and the curtain's text. A [slug] page: the choice is for every item page (its template), the
  text is the item's in the preview. One undo step each.
    live  reactive store; onsettings  open Settings (the curtain's timing)
-->
<script>
  import Field from './Field.svelte';
  import { ui } from './ui.svelte.js';
  import { setCurtainMode } from './curtain-edit.js';
  import { splitEdit } from './content-groups.js';
  import { CURTAIN_MODES, curtainMode } from '../../client/anim/curtain.js';
  import { getRoutes } from '../../site/routes.js';
  import { contentFromFiles } from '../../site/files.js';

  let { live, onsettings } = $props();

  const LABELS = { global: 'Global', off: 'Off' };
  const route = $derived.by(() => {
    live.version;
    return getRoutes(contentFromFiles(live.store.current)).find((r) => r.path === ui.path);
  });
  const page = $derived(route ? splitEdit(route.transitionEdit) : null);
  const text = $derived(route ? splitEdit(route.curtainEdit) : null);
  const mode = $derived.by(() => {
    live.version;
    return page ? curtainMode(live.get(page.file, page.ptr)) : 'global';
  });
</script>

{#if page}
  <h3 class="pane__head">Curtain</h3>
  <div class="fields">
    <div class={['tf', live.changed(page.file, page.ptr) && 'is-changed']}>
      <span class="tf__label"
        >{route.template ? 'Curtain for every item page' : 'Curtain for this page'}</span
      >
      <div class="seg" role="radiogroup" aria-label="Curtain for this page">
        {#each CURTAIN_MODES as m (m)}
          <button
            type="button"
            role="radio"
            aria-checked={mode === m}
            class={['seg__btn', mode === m && 'is-active']}
            onclick={() => setCurtainMode(live.store, page, m)}>{LABELS[m]}</button
          >
        {/each}
      </div>
    </div>
    <!-- one line for both choices, so switching moves nothing -->
    <p class="hint small pc__note">
      {#if mode === 'off'}
        No curtain when you navigate here: the page fades in.
      {:else}
        The site's curtain; its timing is one setting for every page.
      {/if}
      <button type="button" class="link" onclick={onsettings}>Settings</button>
    </p>
    <Field
      edit={route.curtainEdit}
      label={route.template ? 'Curtain text (this item)' : 'Curtain text'}
      placeholder="Leave empty to hide the label"
      value={live.get(text.file, text.ptr)}
      changed={live.changed(text.file, text.ptr)}
      onvalue={(v) =>
        live.store.set(text.file, text.ptr, v, {
          source: 'panel',
          key: `curtain-text:${route.curtainEdit}`,
        })}
    />
  </div>
{/if}

<style lang="scss">
  .pc__note {
    min-height: 32px;
    margin: 0;
  }
</style>
