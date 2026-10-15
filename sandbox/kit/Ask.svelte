<!--
  A section's delete confirm as built (SectionsList.svelte's .ask), for SectionCard's `over`
  snippet (pair it with `red`): over the card at its size, the card's colour at 80%, the
  question at the top (no background of its own), Cancel / Delete (trash icon) at the bottom,
  8px in.
    question  the line at the top (default 'Delete this section?')
-->
<script>
  import Button from '../../src/editor/svelte/Button.svelte';

  let { question = 'Delete this section?' } = $props();
</script>

<div class="kit-over kit-ask" role="alertdialog" aria-label={question}>
  <p class="kit-ask__msg">{question}</p>
  <div class="kit-ask__btns">
    <Button size="small">Cancel</Button>
    <Button size="small" variant="danger" icon="trash">Delete</Button>
  </div>
</div>

<style lang="scss">
  .kit-ask {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-2);
    overflow: auto;
    background: color-mix(in srgb, var(--c-card) 80%, transparent);
  }

  .kit-ask__msg {
    margin: 0;
    color: var(--c-text-strong);
    font-size: var(--fs-base);
    font-weight: 500;
    letter-spacing: 0.1em;
    line-height: 20px;
    text-transform: uppercase;
    overflow-wrap: anywhere;
  }

  .kit-ask__btns {
    display: flex;
    flex: none;
    justify-content: flex-end;
    gap: var(--space-2);
  }
</style>
