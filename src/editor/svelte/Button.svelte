<!--
  The editor's button: a pill after the footer's Save / Publish, or a round icon button.
    variant   'default' | 'primary' (the main action, light) | 'danger' (red: Delete, Discard)
    size      'default' (40px; icon only 36px) | 'small' (32px; icon only 24px, unfilled)
    icon      Font Awesome name without the prefix, e.g. 'trash'
    iconOnly  round, just the icon; label is its aria-label and title
    label     the text when there are no children
    href      renders an <a> instead of a <button>
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
    href,
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

{#if href}
  <a
    class={classes}
    href={disabled ? undefined : href}
    aria-disabled={disabled || undefined}
    aria-label={name}
    title={title ?? name}
    {onclick}
    {...rest}>{@render content()}</a
  >
{:else}
  <button
    {type}
    class={classes}
    {disabled}
    aria-label={name}
    title={title ?? name}
    {onclick}
    {...rest}>{@render content()}</button
  >
{/if}

<style lang="scss">
  .btn {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 20px;
    border: 0;
    border-radius: 999px;
    cursor: pointer;
    color: var(--fg);
    background: var(--btn);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 0.12),
      inset 0 0 0 1px var(--line);
    font-size: 11px;
    line-height: 16px; // 12 + 16 + 12 = 40px
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-weight: 500;
    white-space: nowrap;
    text-decoration: none;
    transition: background 0.2s;

    &:hover:not(:disabled, [aria-disabled]) {
      background: var(--btn-hover);
    }

    &:disabled,
    &[aria-disabled] {
      opacity: 0.35;
      cursor: default;
    }
  }

  .btn--small {
    padding: 8px 16px; // 32px
  }

  .btn--primary {
    color: #000;
    background: var(--fg);
    box-shadow: none;

    &:hover:not(:disabled, [aria-disabled]) {
      background: #fff;
    }
  }

  .btn--danger {
    color: #fff4f2;
    background: var(--danger);
    box-shadow: none;

    &:hover:not(:disabled, [aria-disabled]) {
      background: var(--danger-hover);
    }
  }

  // round, just the icon
  .btn--icon {
    width: 36px;
    height: 36px;
    padding: 0;
    font-size: 15px;
  }

  // small and round: unfilled until hover (in rows: edit, reset, remove, move, replay)
  .btn--icon.btn--small {
    width: 24px;
    height: 24px;
    font-size: 11px;
    color: var(--muted);
    background: none;
    box-shadow: none;

    &:hover:not(:disabled, [aria-disabled]) {
      color: var(--fg);
      background: var(--btn-hover);
    }
  }

  // last: the focus ring wins over every variant's shadow
  .btn:focus-visible {
    outline: none;
    box-shadow:
      inset 0 0 0 1px var(--ed-accent),
      0 0 0 3px color-mix(in srgb, var(--ed-accent) 12%, transparent);
  }
</style>
