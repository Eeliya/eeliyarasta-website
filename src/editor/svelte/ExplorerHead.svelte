<!--
  Header of an explorer window (Sources, Pages): Back when inside something, the title,
  where it is (content/...) and Close.
-->
<script>
  // back: the Back button's label ('' = no Back button)
  let { title, path, icon = 'fa-folder-open', back = '', onback, onclose } = $props();
</script>

<header class="xhead">
  {#if back}
    <button type="button" class="xhead__btn" title={back} aria-label={back} onclick={onback}>
      <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
    </button>
  {/if}
  <h3 class="modal__title">{title}</h3>
  <span class="xhead__path">
    <i class={['fa-solid', icon]} aria-hidden="true"></i>
    {path}
  </span>
  <button type="button" class="xhead__btn" title="Close (Esc)" aria-label="Close" onclick={onclose}>
    <i class="fa-solid fa-xmark" aria-hidden="true"></i>
  </button>
</header>

<style lang="scss">
  .xhead {
    grid-column: 1 / -1;
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 20px 24px 16px;
    border-bottom: 1px solid var(--line);

    .modal__title {
      margin: 0;
    }
  }

  .xhead__path {
    margin-right: auto;
    color: var(--muted);
    font-size: 10.5px;
  }

  // Back and Close
  .xhead__btn {
    align-self: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: 8px;
    background: none;
    color: var(--muted);
    font-size: 14px;
    cursor: pointer;

    &:hover {
      color: var(--fg);
      background: rgb(255 255 255 / 0.06);
    }

    &:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 1px var(--ed-accent);
    }
  }
</style>
