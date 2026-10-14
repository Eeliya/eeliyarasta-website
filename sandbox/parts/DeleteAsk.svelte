<!-- mock: a section's delete question over its card (the kit's SectionCard `over`).
     bar: only the header's height, in one row; look: solid | blur (Eeliya's exception: a
     backdrop blur under a light tint); strip: only the header's 46px (default: bar; false covers a closed card whatever its height); text: the question (default "Delete <name>?"); trash: where the trash icon goes, 'title' or 'button' (in Delete) -->
<script>
  import Button from '../../src/editor/svelte/Button.svelte';

  let {
    bar = false,
    look = 'solid',
    name = 'Section 6',
    blocks = 2,
    trash = 'title',
    text = '',
    strip = bar,
  } = $props();
</script>

<div
  class={['kit-over', strip && 'kit-over--bar', 'ask', `ask--${look}`, bar && 'ask--row']}
  role="alertdialog"
  aria-label="Delete {name}?"
>
  {#if trash === 'title'}<span class="ask__icon"><i class="fa-solid fa-trash"></i></span>{/if}
  <p class="ask__msg">
    {#if text}{text}{:else if bar}Delete {name}?{:else}Delete <b>{name}</b> and its {blocks} blocks?{/if}
  </p>
  {#if !bar}<p class="ask__sub">Undo brings it back.</p>{/if}
  <span class="ask__btns">
    <Button size="small">Cancel</Button>
    <Button size="small" variant="danger" icon={trash === 'button' ? 'trash' : ''}>Delete</Button>
  </span>
</div>

<style lang="scss">
  .ask {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-4);
    color: var(--c-text);
    text-align: center;
  }

  .ask--solid {
    background: var(--c-card);
  }

  .ask--blur {
    background: rgb(20 20 20 / 35%);
    backdrop-filter: blur(6px);
  }

  .ask__icon {
    display: grid;
    flex: none;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: var(--radius-round);
    background: var(--c-danger);
    color: var(--c-on-danger);
  }

  .ask__msg {
    margin: 0;
    font-size: var(--fs-base);
    line-height: 20px;

    b {
      color: var(--c-text-strong);
      font-weight: 600;
    }
  }

  .ask__sub {
    margin: 0;
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }

  .ask__btns {
    display: flex;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }

  // one row: trash | question | Cancel Delete, the header's height
  .ask--row {
    flex-direction: row;
    justify-content: flex-start;
    padding: 0 var(--space-2);
    text-align: left;

    .ask__icon {
      width: 24px;
      height: 24px;
      font-size: var(--fs-xs);
    }

    .ask__msg {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      font-size: var(--fs-sm);
      font-weight: 500;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .ask__btns {
      margin: 0;
    }
  }
</style>
