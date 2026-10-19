<!--
  One block in a section card's list (SectionCard.svelte), no order (blocks are placed in the
  preview), on the blocks' card colour (--c-block-card): its type with its title under it in
  the blocks' accent (--c-block-accent), then its eye, Duplicate and
  Delete. A click on the row opens its settings (onopen). Hidden (config.enabled false): its
  name and title faint, its eye-slash. Delete asks over the row at its size (nothing moves).
  Its buttons rest at 30% and show fully while the row is hovered or has the focus; an
  eye-slash always (SectionCard.svelte's rule for the card's own buttons).
    block      { id, type, title?, config? }
    onopen     () => open its settings
    onshow     (on) => show (true) or hide it
    onduplicate, ondelete
-->
<script>
  import Button from './Button.svelte';
  import { nameOf } from './content-groups.js';
  import { BLOCK_TYPES } from '../../site/blocks/index.js';

  let { block, onopen, onshow, onduplicate, ondelete } = $props();
  let asking = $state(false);

  const label = $derived(BLOCK_TYPES[block?.type]?.label || `Unknown type "${block?.type}"`);
  const name = $derived(nameOf(block));
  const on = $derived(block?.config?.enabled !== false);
  // the confirm's Cancel takes the focus (Enter does not delete by accident)
  const focusCancel = (el) => el.querySelector('.ask-btns > :last-child')?.focus();
</script>

<li class={['brow', !on && 'is-off']} data-row>
  <button type="button" class="brow__open" title="Open {label}" onclick={onopen}>
    <span>{label}</span>
    {#if name}<span class="brow__name">{name}</span>{/if}
  </button>
  <Button
    size="small"
    icon={on ? 'eye' : 'eye-slash'}
    iconOnly
    label="Show {label}"
    title={on
      ? `Visible: click to hide ${label}`
      : `Hidden on the public page: click to show ${label}`}
    aria-pressed={on}
    data-eye
    onclick={() => onshow(!on)}
  />
  <Button size="small" icon="copy" iconOnly label="Duplicate {label}" onclick={onduplicate} />
  <Button
    size="small"
    icon="trash"
    iconOnly
    label="Delete {label}"
    onclick={() => (asking = true)}
  />
  {#if asking}
    <div
      class="brow__ask"
      role="alertdialog"
      tabindex="-1"
      aria-label="Delete {label}?"
      {@attach focusCancel}
      onkeydown={(e) => e.key === 'Escape' && (e.stopPropagation(), (asking = false))}
    >
      <span>Delete {label}?</span>
      <span class="ask-btns">
        <Button
          size="small"
          variant="danger"
          icon="trash"
          iconOnly
          label="Delete"
          onclick={() => {
            asking = false;
            ondelete();
          }}
        />
        <Button size="small" onclick={() => (asking = false)}>Cancel</Button>
      </span>
    </div>
  {/if}
</li>

<style lang="scss">
  @use '../styles/mixins' as *;

  // [ Type / its title        eye copy trash ]: 48px; the icons end on its right edge (the
  // card's content edge, as the title row's)
  .brow {
    @include row(var(--space-1));
    position: relative;
    min-height: 48px;
    border-radius: var(--radius-md);
    background: var(--c-block-card);

    > :global(.btn) {
      flex: none;
      opacity: 0.3;
      transition: opacity 0.15s;
    }

    &:is(:hover, :focus-within) > :global(.btn),
    > :global(.btn:focus-visible),
    > :global(.btn[data-eye][aria-pressed='false']) {
      opacity: 1;
    }
  }

  // its text 12px in, two 20px lines, 4px above and below
  .brow__open {
    display: grid;
    flex: 1;
    align-self: stretch;
    min-width: 0;
    padding: var(--space-1) var(--space-2) var(--space-1) var(--space-3);
    border: 0;
    border-radius: var(--radius-md);
    background: none;
    color: var(--c-text);
    font: inherit;
    font-size: var(--fs-base);
    line-height: 20px;
    text-align: left;
    align-content: center;
    cursor: pointer;

    span {
      @include ellipsis;
    }

    &:focus-visible {
      @include focus-ring;
    }

    .is-off > & {
      color: var(--c-text-faint);
    }
  }

  // the blocks' accent (their card colour's pair: a card's colour says its type)
  .brow__name {
    color: var(--c-block-accent);

    .is-off & {
      color: var(--c-text-faint);
    }
  }

  // Delete?: over the row at its size and corners, one line, 12px in on every side (24px
  // buttons in the 48px row), a red line
  .brow__ask {
    @include row(var(--space-3));
    position: absolute;
    inset: 0;
    z-index: 1;
    padding: 0 var(--space-3);
    border-radius: inherit;
    background: var(--c-block-card);
    box-shadow: inset 0 0 0 1px var(--c-danger);
    font-size: var(--fs-base);

    > span:first-child {
      @include ellipsis;
      flex: 1;
    }
  }
</style>
