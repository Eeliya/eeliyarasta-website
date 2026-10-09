<!--
  A collapsible panel section: a bar (a toggle button with the caret and title, then the `bar`
  snippet's controls) and the body, hidden while closed (it stays in the DOM, so a field picked
  in the preview can be found and its section opened). Used by the Content, Motion and Settings
  tabs and the Animations library. .sec is a flex column: bar, body.

    title     the bar title (small caps)
    name      optional: what it is, on a second line in the accent color
              ("Page transition" / "Curtain")
    key       remembers open/closed in ui.sections (also kept across a refresh, persist.js),
              e.g. "settings:site"; without it the section just starts as `open`
    open      open when nothing is remembered yet (default true)
    id        data-section, to find the section (e.g. scroll to it)
    off       dimmed: the section is turned off
    class     extra class on the section
    bar       snippet: controls at the right of the bar (count, buttons, a switch), each 20px tall
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

  const uid = $props.id();
  let toggled = $state(null); // open/closed of a section without a key
  const isOpen = $derived((key ? ui.sections[key] : toggled) ?? open);

  function toggle() {
    if (key) ui.sections[key] = !isOpen;
    else toggled = !isOpen;
  }
</script>

<section class={['sec', off && 'is-off', cls]} data-section={id}>
  <div class="sec__bar">
    <button
      type="button"
      class="sec__toggle"
      aria-expanded={isOpen}
      aria-controls="{uid}-body"
      onclick={toggle}
    >
      <i class="fa-solid fa-chevron-right sec__caret" aria-hidden="true"></i>
      {title}
      {#if name}<strong>{name}</strong>{/if}
    </button>
    {@render bar?.()}
  </div>
  <div class="sec__body" id="{uid}-body" hidden={!isOpen}>
    {@render children?.()}
  </div>
</section>

<style lang="scss">
  .sec {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px 0;
    border-top: 1px solid var(--line);
  }

  // the toggle, then on the right whatever the `bar` snippet adds; every item is 20px tall
  // (a toggle with a name has a second 20px line)
  .sec__bar {
    display: flex;
    align-items: flex-start;
    gap: 4px;
    font-size: 12px;
    line-height: 20px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--solid-faint);

    > :global(*) {
      flex: none;
    }

    // a changed-dot (8px) centered on the first line
    > :global(.dot) {
      margin: 6px 0;
    }
  }

  // caret | title, with the name under the title
  .sec__toggle {
    flex: 1;
    min-width: 0;
    display: grid;
    grid-template-columns: 20px minmax(0, 1fr);
    column-gap: 4px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: none;
    font: inherit;
    letter-spacing: inherit;
    text-transform: inherit;
    text-align: left;
    color: inherit;
    cursor: pointer;

    &:hover {
      color: #fff;
    }

    &:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 1px var(--hi);
    }

    // the name under the title, like .grp__title strong
    strong {
      grid-column: 2;
      font-weight: 400;
      color: var(--accent);
    }
  }

  // (display comes from Font Awesome's .fa-solid)
  .sec__caret {
    width: 20px;
    height: 20px;
    color: var(--muted);
    font-size: 10px;
    line-height: 20px;
    text-align: center;
    transition: rotate 0.15s;

    [aria-expanded='true'] > & {
      rotate: 90deg;
    }
  }

  .sec__body > :global(* + *) {
    margin-top: 12px;
  }

  .sec.is-off {
    .sec__toggle {
      color: var(--muted);
    }

    .sec__body {
      opacity: 0.55;
    }
  }
</style>
