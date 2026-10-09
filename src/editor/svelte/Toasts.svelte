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
