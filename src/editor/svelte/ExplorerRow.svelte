<!--
  One row of an explorer list (Sources, Pages): a number or an icon, the name with a meta
  line below it, and a dot when it has unsaved changes. Other props (onclick, data-*,
  aria-*) go on the <button>.
-->
<script>
  let {
    lead = '',
    icon = '',
    name,
    meta = '',
    selected = false,
    changed = false,
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
</button>

<style lang="scss">
  // lead | name / meta | changed dot
  .xrow {
    width: 100%;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 4px 12px;
    padding: 8px 12px;
    line-height: 16px; // two lines: 52px
    border: 0;
    border-radius: 12px;
    background: none;
    text-align: left;
    cursor: pointer;
    color: var(--fg);

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
      background: rgb(255 255 255 / 0.05);
    }

    &:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 1px var(--ed-accent);
    }

    &.is-selected {
      background: color-mix(in srgb, var(--ed-accent) 20%, transparent);
    }
  }

  .xrow__lead {
    grid-row: 1 / 3;
    color: var(--muted);
    font-size: 10px;

    &--icon {
      font-size: 14px;
    }
  }

  .xrow__name,
  .xrow__meta {
    grid-column: 2;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .xrow__meta {
    color: var(--muted);
    font-size: 10.5px;
  }
</style>
