<!--
  One row of an explorer list (Sources, Pages): a number or an icon, the name with a meta
  line below it, a dot in its left padding when it has unsaved changes, and a chevron when it opens something
  (enter). Other props (onclick, data-*, aria-*) go on the <button>.
-->
<script>
  let {
    lead = '',
    icon = '',
    name,
    meta = '',
    selected = false,
    changed = false,
    enter = false,
    ...rest
  } = $props();
</script>

<button
  type="button"
  class={['xrow', selected && 'is-selected', changed && 'is-changed']}
  {...rest}
>
  {#if icon}
    <i class={['fa-solid', icon, 'xrow__lead', 'xrow__lead--icon']} aria-hidden="true"></i>
  {:else}
    <span class="xrow__lead">{lead}</span>
  {/if}
  <span class="xrow__name">{name}</span>
  <span class="xrow__meta">{meta}</span>

  {#if enter}<i class="fa-solid fa-chevron-right xrow__enter" aria-hidden="true"></i>{/if}
</button>

<style lang="scss">
  @use '../styles/mixins' as *;

  // lead | name / meta | chevron; changed: a dot in the left padding (.is-changed, editor.scss)
  .xrow {
    width: 100%;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-1) var(--space-3);
    padding: var(--space-2) var(--space-3);
    line-height: 16px; // two lines: 52px
    border: 0;
    border-radius: var(--radius-lg);
    background: none;
    text-align: left;
    cursor: pointer;
    color: var(--c-text);

    &:hover {
      background: var(--white-a05);
    }

    &:focus-visible {
      @include focus-ring;
    }

    &.is-selected {
      background: color-mix(in srgb, var(--c-accent) 20%, transparent);
    }
  }

  .xrow__lead {
    grid-row: 1 / 3;
    color: var(--c-text-muted);
    font-size: var(--fs-xs);

    &--icon {
      font-size: var(--fs-md);
    }
  }

  .xrow__enter {
    grid-column: 3;
    grid-row: 1 / 3;
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
  }

  .xrow__name,
  .xrow__meta {
    grid-column: 2;
    @include ellipsis;
  }

  .xrow__meta {
    @include muted;
  }
</style>
