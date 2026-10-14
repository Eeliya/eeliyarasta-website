<!--
  The editor's button: a pill after the footer's Save / Publish, or a round icon button.
    variant   'default' | 'primary' (the main action, light) | 'danger' (red: Delete, Discard)
              | 'file' (a file name as written, e.g. people.json: not uppercase, 24px)
    size      'default' (40px; icon only 32px) | 'small' (32px; icon only 24px, unfilled)
    icon      Font Awesome name without the prefix, e.g. 'trash'
    iconOnly  just the icon, quiet: a utility (Grid, the phone view, undo / redo, close): no
              background, a little dim, brighter on hover; with aria-pressed it is a toggle,
              --c-accent while on. label is its aria-label and title
    label     the text when there are no children
  Also disabled, type ('button'), title, onclick; anything else (aria-*, data-*, attachments)
  goes on the element. Hover only brightens the background; nothing moves.
-->
<script>
  let {
    variant = 'default',
    size = 'default',
    icon = '',
    iconOnly = false,
    label = '',
    disabled = false,
    type = 'button',
    title,
    onclick,
    children,
    ...rest
  } = $props();

  const classes = $derived([
    'btn',
    size === 'small' && 'btn--small',
    variant !== 'default' && `btn--${variant}`,
    iconOnly && 'btn--icon',
  ]);
  const name = $derived(iconOnly ? label : undefined);
</script>

{#snippet content()}
  {#if icon}<i class="fa-solid fa-{icon}" aria-hidden="true"></i>{/if}
  {#if !iconOnly}{#if children}{@render children()}{:else}{label}{/if}{/if}
{/snippet}

<button
  {type}
  class={classes}
  {disabled}
  aria-label={name}
  title={title ?? name}
  {onclick}
  {...rest}>{@render content()}</button
>

<style lang="scss">
  .btn {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-3) 20px;
    border: 0;
    border-radius: var(--radius-pill);
    cursor: pointer;
    color: var(--c-text);
    background: var(--c-control);
    box-shadow:
      inset 0 1px 0 var(--white-a12),
      inset 0 0 0 1px var(--c-line);
    font-size: var(--fs-sm);
    line-height: 16px; // 12 + 16 + 12 = 40px
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-weight: 500;
    white-space: nowrap;
    text-decoration: none;
    transition: background 0.2s;

    &:hover:not(:disabled, [aria-disabled]) {
      background: var(--c-control-hover);
    }

    &:disabled,
    &[aria-disabled] {
      opacity: var(--o-disabled);
      cursor: default;
    }
  }

  .btn--small {
    padding: var(--space-2) var(--space-4); // 32px
  }

  .btn--primary {
    color: var(--c-on-light);
    background: var(--c-text);
    box-shadow: none;

    &:hover:not(:disabled, [aria-disabled]) {
      background: var(--c-text-strong);
    }
  }

  .btn--danger {
    color: var(--c-on-danger);
    background: var(--c-danger);
    box-shadow: none;

    &:hover:not(:disabled, [aria-disabled]) {
      background: var(--c-danger-hover);
    }
  }

  // a file name: as written, 24px
  .btn--file {
    padding: var(--space-1) var(--space-3);
    letter-spacing: 0;
    text-transform: none;
  }

  // just the icon: a quiet utility, no pill; a toggle (aria-pressed) is the accent while on
  .btn--icon {
    width: 32px;
    height: var(--size-control);
    padding: 0;
    font-size: var(--fs-lg);
    color: var(--c-text-muted);
    background: none;
    box-shadow: none;
    transition: color 0.2s;

    &:hover:not(:disabled, [aria-disabled]) {
      color: var(--c-text);
      background: none;
    }

    &[aria-pressed='true'],
    &[aria-pressed='true']:hover:not(:disabled, [aria-disabled]) {
      color: var(--c-accent);
    }
  }

  // small and round: unfilled until hover (in rows: edit, reset, remove, move, replay)
  .btn--icon.btn--small {
    width: 24px;
    height: 24px;
    font-size: var(--fs-sm);
    color: var(--c-text-muted);
    background: none;
    box-shadow: none;

    &:hover:not(:disabled, [aria-disabled]) {
      color: var(--c-text);
      background: var(--c-control-hover);
    }

    &[aria-pressed='true'] {
      color: var(--c-accent);
    }
  }

  // last: the focus ring wins over every variant's shadow
  .btn:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
</style>
