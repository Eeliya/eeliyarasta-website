<!--
  The toasts of toasts.svelte.js, bottom left, newest last. A popover in the top layer, shown
  again for every new toast: above an open window (Media, Pages, ...) too.
-->
<script>
  import Button from './Button.svelte';
  import { toasts, dismiss } from './toasts.svelte.js';

  let box = $state();
  $effect(() => {
    const last = toasts.at(-1)?.id; // a new toast: on top of whatever opened since
    if (!box) return;
    if (box.matches(':popover-open')) box.hidePopover();
    if (last) box.showPopover();
  });
</script>

<section class="ed-toasts" aria-live="polite" popover="manual" bind:this={box}>
  {#each toasts as t (t.id)}
    <p class="toast toast--{t.kind}">
      {t.text}
      {#each t.files as f, i (f)}{i ? ', ' : ''}<code>content/{f}</code>{/each}
      {t.note}
      {#if t.link}
        <a href={t.link.href} target="_blank" rel="noopener">
          {t.link.label}
          <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
        </a>
      {/if}
      <Button size="small" icon="xmark" iconOnly label="Dismiss" onclick={() => dismiss(t.id)} />
    </p>
  {/each}
</section>

<style lang="scss">
  @keyframes fade {
    from {
      opacity: 0;
    }
  }

  .ed-toasts {
    position: fixed;
    inset: auto auto 24px 24px;
    margin: 0;
    padding: 0;
    border: 0;
    overflow: visible;
    color: inherit;
    background: none;
    display: grid;
    gap: var(--space-2);
    max-width: min(460px, calc(100vw - var(--panel-w) - 72px));
  }

  .toast {
    position: relative;
    margin: 0;
    padding: var(--space-3) 36px var(--space-3) var(--space-4);
    border-radius: var(--radius-lg);
    animation: fade 0.3s;
    // solid like the dialogs: no see-through, no blur
    background: var(--c-card);
    box-shadow:
      inset 0 0 0 1px var(--c-fill-active),
      0 24px 60px -20px var(--c-scrim);

    &--ok {
      box-shadow:
        inset 3px 0 0 var(--c-success),
        inset 0 0 0 1px var(--c-line),
        0 20px 40px -16px var(--black);
    }

    &--error {
      box-shadow:
        inset 3px 0 0 var(--c-error),
        inset 0 0 0 1px var(--c-line),
        0 20px 40px -16px var(--black);
    }

    code {
      color: var(--c-text);
    }
  }

  .toast > :global(.btn) {
    position: absolute;
    top: 8px;
    right: 8px;
  }
</style>
