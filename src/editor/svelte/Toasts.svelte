<!-- The toasts of toasts.svelte.js, bottom left, newest last. -->
<script>
  import { toasts, dismiss } from './toasts.svelte.js';
</script>

<section class="ed-toasts" aria-live="polite">
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
      <button type="button" class="toast__x" aria-label="Dismiss" onclick={() => dismiss(t.id)}>
        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>
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
    left: 24px;
    bottom: 24px;
    z-index: 60;
    display: grid;
    gap: 8px;
    max-width: min(460px, calc(100vw - var(--panel-w) - 72px));
  }

  .toast {
    position: relative;
    margin: 0;
    padding: 12px 36px 12px 14px;
    border-radius: 12px;
    animation: fade 0.3s;
    // solid like the dialogs: no see-through, no blur
    background: var(--solid-card, #212121);
    box-shadow:
      inset 0 0 0 1px rgb(255 255 255 / 0.08),
      0 24px 60px -20px rgb(0 0 0 / 0.9);

    &--ok {
      box-shadow:
        inset 3px 0 0 #b9f0c4,
        inset 0 0 0 1px var(--line),
        0 20px 40px -16px #000;
    }

    &--error {
      box-shadow:
        inset 3px 0 0 #ff8a7a,
        inset 0 0 0 1px var(--line),
        0 20px 40px -16px #000;
    }

    code {
      color: var(--fg);
    }
  }

  .toast__x {
    position: absolute;
    top: 6px;
    right: 8px;
    border: 0;
    background: none;
    color: var(--muted);
    cursor: pointer;
    font-size: 13px;
  }
</style>
