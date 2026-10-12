<!--
  One row of an explorer list (Sources, Pages): a number or an icon, the name with a meta
  line below it, a dot when it has unsaved changes, and a chevron when it opens something
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
  <i class="dot" title="Changed"></i>
  {#if enter}<i class="fa-solid fa-chevron-right xrow__enter" aria-hidden="true"></i>{/if}
</button>

<style lang="scss">
  // lead | name / meta | changed dot | chevron
  .xrow {
    width: 100%;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
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

    .dot {
      display: none;
      grid-column: 3;
      grid-row: 1 / 3;
      margin: 0;
    }

    &.is-changed .dot {
      display: inline-block;
    }

    &:hover {
      background: var(--white-a05);
    }

    &:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 1px var(--c-accent);
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
    grid-column: 4;
    grid-row: 1 / 3;
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
  }

  .xrow__name,
  .xrow__meta {
    grid-column: 2;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .xrow__meta {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
</style>
