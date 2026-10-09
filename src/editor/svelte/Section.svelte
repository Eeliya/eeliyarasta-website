<!--
  A collapsible panel section: a <details> with its bar as the <summary>. Used by the
  Content, Motion and Settings tabs.

    title     the bar title (small caps)
    name      optional: what it is, on a second line in the accent color
              ("Page transition" / "Curtain")
    key       remembers open/closed in ui.sections (also kept across a refresh, persist.js),
              e.g. "settings:site"; without it the section just starts as `open`
    open      open when nothing is remembered yet (default true)
    id        data-section, to find the section (e.g. scroll to it)
    off       dimmed: the section is turned off
    class     extra class on the <details>
    bar       snippet: controls at the right of the bar (count, buttons, a switch)
    children  the section body
-->
<script>
  import { ui } from './ui.svelte.js';

  let {
    title,
    name = '',
    key = '',
    open = true,
    id = null,
    off = false,
    class: cls = '',
    bar,
    children,
  } = $props();

  const isOpen = $derived((key ? ui.sections[key] : null) ?? open);
</script>

<details
  class={['sec', off && 'is-off', cls]}
  data-section={id}
  open={isOpen}
  ontoggle={(e) => key && (ui.sections[key] = e.currentTarget.open)}
>
  <summary class="sec__bar">
    <i class="fa-solid fa-chevron-right sec__caret" aria-hidden="true"></i>
    <span class="sec__title"
      >{title}{#if name}<strong>{name}</strong>{/if}</span
    >
    {@render bar?.()}
  </summary>
  {@render children?.()}
</details>

<style lang="scss">
  .sec {
    padding: 10px 0;
    border-top: 1px solid var(--line);

    > summary + :global(*) {
      margin-top: 8px;
    }

    > :global(:not(summary)) {
      margin-left: 2px;
    }

    > :global(:not(summary)) + :global(:not(summary)) {
      margin-top: 12px;
    }
  }

  // caret, title, then on the right whatever the `bar` snippet adds
  .sec__bar {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 26px;
    cursor: pointer;
    list-style: none;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--solid-faint);

    &::-webkit-details-marker {
      display: none;
    }

    &:hover {
      color: #fff;
    }
  }

  .sec__title {
    margin-right: auto;

    // the name under the title, like .grp__title strong
    strong {
      display: block;
      font-weight: 400;
      color: var(--accent);
    }
  }

  // (size and display come from Font Awesome's .fa-solid)
  .sec__caret {
    color: var(--muted);
    flex: none;
    font-size: 10px;
    transition: rotate 0.15s;

    .sec[open] & {
      rotate: 90deg;
    }
  }

  .sec.is-off {
    > summary {
      color: var(--muted);
    }

    > :global(:not(summary)) {
      opacity: 0.55;
    }
  }
</style>
