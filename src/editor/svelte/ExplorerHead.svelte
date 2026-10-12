<!--
  Header of an explorer window (Sources, Pages): Back when inside something, the title with
  where it is under it as a breadcrumb, and Close.
  crumbs: [{ label, onclick? }], the last one is where it is (highlighted); one with an
  onclick goes there. sep: drawn between crumbs ('' = none, the labels carry their slashes).
-->
<script>
  import Button from './Button.svelte';
  // back: the Back button's label ('' = no Back button)
  let { title, crumbs = [], sep = '', icon, back = '', onback, onclose } = $props();
</script>

<header class="xhead">
  {#if back}
    <Button icon="arrow-left" iconOnly label={back} onclick={onback} />
  {/if}
  <div class="xhead__main">
    <h3 class="modal__title">{title}</h3>
    <nav class="xhead__path" aria-label="Where you are">
      <i class={['fa-solid', icon]} aria-hidden="true"></i>
      {#each crumbs as c, i (i)}
        {#if i && sep}<span class="xhead__sep" aria-hidden="true">{sep}</span>{/if}
        {#if i === crumbs.length - 1}
          <span class="xhead__crumb is-current" aria-current="location">{c.label}</span>
        {:else if c.onclick}
          <button type="button" class="xhead__crumb" onclick={c.onclick}>{c.label}</button>
        {:else}
          <span class="xhead__crumb">{c.label}</span>
        {/if}
      {/each}
    </nav>
  </div>
  <Button icon="xmark" iconOnly label="Close" title="Close (Esc)" onclick={onclose} />
</header>

<style lang="scss">
  .xhead {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: 20px var(--space-5) var(--space-4);
    border-bottom: 1px solid var(--c-line);
  }

  .xhead__main {
    flex: 1;
    min-width: 0;

    .modal__title {
      margin: 0 0 var(--space-1);
    }
  }

  // the breadcrumb: earlier crumbs muted (links), the last one bright
  .xhead__path {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0 var(--space-1);
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    line-height: 16px;

    > i {
      margin-right: var(--space-1);
    }
  }

  .xhead__crumb {
    padding: 0;
    border: 0;
    background: none;
    color: var(--c-text-muted);

    &.is-current {
      color: var(--c-text);
    }
  }

  button.xhead__crumb {
    cursor: pointer;
    text-decoration: underline;
    text-decoration-color: var(--c-text-faint);
    text-underline-offset: 4px;

    &:hover {
      color: var(--c-text);
    }

    &:focus-visible {
      outline: none;
      color: var(--c-text);
      box-shadow: 0 1px 0 var(--c-accent);
    }
  }

  .xhead__sep {
    color: var(--c-text-faint);
  }
</style>
