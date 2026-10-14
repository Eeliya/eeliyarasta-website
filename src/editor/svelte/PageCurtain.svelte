<!--
  Content > Transitions: the page's curtain, plain fields under a "Curtain" heading. Global (the
  site's curtain, its timing in Settings) or Off (no curtain when you navigate here: a fade),
  and the curtain's text: unset, the page's title (the placeholder); ✕ stores "" (No label:
  none). A [slug] page: the choice is for every item page (its template), the
  text is the item's in the preview. One undo step each.
    live  reactive store; onsettings  open Settings (the curtain's timing)
-->
<script>
  import Button from './Button.svelte';
  import Field from './Field.svelte';
  import { ui } from './ui.svelte.js';
  import { setCurtainMode } from './curtain-edit.js';
  import { splitEdit } from '../../site/helpers.js';
  import { CURTAIN_MODES, curtainMode } from '../../client/anim/curtain.js';

  let { live, onsettings } = $props();

  const LABELS = { global: 'Global', off: 'Off' };
  const route = $derived(live.routeOf(ui.path));
  const page = $derived(route ? splitEdit(route.transitionEdit) : null);
  const text = $derived(route ? splitEdit(route.curtainEdit) : null);
  const stored = $derived.by(() => {
    live.version;
    return text ? live.get(text.file, text.ptr) : undefined;
  });
  const textChanged = $derived(!!text && live.changed(text.file, text.ptr));
  // what an unset text shows: the page's (or item's) title, before " | Site"
  const title = $derived(
    String(route?.title || '')
      .split('|')[0]
      .trim(),
  );
  const textLabel = $derived(route?.template ? 'Curtain text (this item)' : 'Curtain text');
  const setText = (v) =>
    live.store.set(text.file, text.ptr, v, {
      source: 'panel',
      key: `curtain-text:${route.curtainEdit}`,
    });

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
    <!-- unset: the page's title (the placeholder); "" (No label): none. One row for both. -->
    {#if stored === ''}
      <div class={['tf', textChanged && 'is-changed']}>
        <span class="tf__label">{textLabel}</span>
        <div class="pc__row">
          <span class="pc__none">No label</span>
          <Button size="small" icon="rotate-left" onclick={() => setText(undefined)}>
            Use the title
          </Button>
        </div>
      </div>
    {:else}
      <div class="pc__field">
        <Field
          edit={route.curtainEdit}
          label={textLabel}
          placeholder={title}
          value={stored}
          changed={textChanged}
          onvalue={(v) => setText(v === '' ? undefined : v)}
        />
        <Button
          size="small"
          icon="xmark"
          iconOnly
          label="No label"
          title="No label: the curtain shows no text"
          onclick={() => setText('')}
        />
      </div>
    {/if}
  </div>
{/if}

<style lang="scss">
  // the field with its ✕ at the end of its input's row (the label row above stays the field's)
  .pc__field {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
    gap: var(--space-2);
  }

  .pc__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 32px;
  }

  .pc__none {
    color: var(--c-text-muted);
  }

  .pc__note {
    min-height: 32px;
    margin: 0;
  }
</style>
