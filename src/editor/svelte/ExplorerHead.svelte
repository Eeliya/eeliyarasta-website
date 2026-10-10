<!--
  Header of an explorer window (Sources, Pages): Back when inside something, the title with
  where it is under it as a breadcrumb, and Close.
  crumbs: [{ label, onclick? }], the last one is where it is (highlighted); one with an
  onclick goes there. sep: drawn between crumbs ('' = none, the labels carry their slashes).
-->
<script>
  // back: the Back button's label ('' = no Back button)
  let { title, crumbs = [], sep = '', icon, back = '', onback, onclose } = $props();
</script>

<header class="xhead">
  {#if back}
    <button type="button" class="icon-btn" title={back} aria-label={back} onclick={onback}>
      <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
    </button>
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
  <button type="button" class="icon-btn" title="Close (Esc)" aria-label="Close" onclick={onclose}>
    <i class="fa-solid fa-xmark" aria-hidden="true"></i>
  </button>
</header>

<style lang="scss">
  .xhead {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 20px 24px 16px;
    border-bottom: 1px solid var(--line);
  }

  .xhead__main {
    flex: 1;
    min-width: 0;

    .modal__title {
      margin: 0 0 4px;
    }
  }

  // the breadcrumb: earlier crumbs muted (links), the last one bright
  .xhead__path {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0 4px;
    color: var(--muted);
    font-size: 11px;
    line-height: 16px;

    > i {
      margin-right: 4px;
    }
  }

  .xhead__crumb {
    padding: 0;
    border: 0;
    background: none;
    color: var(--muted);

    &.is-current {
      color: var(--fg);
    }
  }

  button.xhead__crumb {
    cursor: pointer;
    text-decoration: underline;
    text-decoration-color: var(--faint);
    text-underline-offset: 4px;

    &:hover {
      color: var(--fg);
    }

    &:focus-visible {
      outline: none;
      color: var(--fg);
      box-shadow: 0 1px 0 var(--ed-accent);
    }
  }

  .xhead__sep {
    color: var(--faint);
  }
</style>
