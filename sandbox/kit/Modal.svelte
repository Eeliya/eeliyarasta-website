<!--
  A modal's shell, drawn in place (not on the top layer): the real .modal__box with the real
  ExplorerHead, a body and an optional footer.
    title, icon ('fa-…'), crumbs   ExplorerHead's      width, height   the box (default 720 × 480)
    children  the body            foot  snippet: the footer's content (hint, buttons)
-->
<script>
  import ExplorerHead from '../../src/editor/svelte/ExplorerHead.svelte';

  let {
    title,
    icon = 'fa-window-maximize',
    crumbs = [],
    width = '720px',
    height = '480px',
    children,
    foot,
  } = $props();
</script>

<div class="modal__box kit-modal" role="dialog" aria-label={title} style:width style:height>
  <ExplorerHead {title} {icon} {crumbs} onclose={() => {}} />
  <div class="kit-modal__body">{@render children?.()}</div>
  {#if foot}<footer class="kit-modal__foot">{@render foot()}</footer>{/if}
</div>

<style lang="scss">
  .kit-modal.kit-modal {
    position: relative;
    inset: auto;
    transform: none;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    max-width: none;
    max-height: none;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }

  .kit-modal__body {
    padding: var(--space-4);
    overflow: auto;
  }

  .kit-modal__foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    height: 56px;
    padding: 0 var(--space-4);
    border-top: 1px solid var(--c-line);
  }
</style>
