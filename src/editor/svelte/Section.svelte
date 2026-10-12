<!--
  A collapsible panel section: a bar (a toggle button with the caret and title, then the `bar`
  snippet's controls) and the body, clipped and inert while closed (it stays in the DOM, so a field picked
  in the preview can be found and its section opened). Used by the Content, Motion and Settings
  tabs and the Animations library. .sec is a flex column: bar, body (.sec__body > .sec__clip > .sec__inner).

    title     the bar title (small caps)
    icon      optional: a Font Awesome icon name before the title (a page section's type)
    name      optional: what it is, on a second line in the accent color
              ("Page transition" / "Curtain")
    key       remembers open/closed in ui.sections (also kept across a refresh, persist.js),
              e.g. "settings:site"; without it the section just starts as `open`
    open      open when nothing is remembered yet (default true)
    id        data-section, to find the section (e.g. scroll to it)
    off       dimmed: the section is turned off
    dim       the title is a default ("Section 1", no name yet): very dim
    class     extra class on the section
    bar       snippet: controls at the right of the bar (count, buttons, a switch), each 20px tall
              (24px for a file button). A panel's own sections keep their bar on top while
              scrolling through them (sticky).
    children  the section body
  Opening and closing animate the body's grid row, 0fr to 1fr (GSAP, 0.25s power2.out): closed
  it is clipped away, still rendered but inert; none with prefers-reduced-motion.
-->
<script>
  import { untrack } from 'svelte';
  import { gsap } from 'gsap';
  import { ui } from './ui.svelte.js';

  let {
    title,
    icon = '',
    name = '',
    key = '',
    open = true,
    id = null,
    off = false,
    dim = false,
    class: cls = '',
    bar,
    children,
  } = $props();

  const uid = $props.id();
  let toggled = $state(null); // open/closed of a section without a key
  const isOpen = $derived((key ? ui.sections[key] : toggled) ?? open);

  // The body is a one-row grid: 1fr open, 0fr closed (CSS, by its inert); its inner element
  // (min-height: 0, overflow: hidden) is clipped to that row. It stays rendered, inert while
  // closed. Opening and closing tween grid-template-rows between them, then hand back to CSS.
  let body = $state();
  let first = true;
  $effect(() => {
    const opening = isOpen;
    untrack(() => {
      if (first) first = false;
      else slide(opening);
    });
  });
  function slide(opening) {
    gsap.killTweensOf(body);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(
      body,
      { gridTemplateRows: opening ? '0fr' : '1fr' },
      {
        gridTemplateRows: opening ? '1fr' : '0fr',
        duration: 0.25,
        ease: 'power2.out',
        onComplete: () => gsap.set(body, { clearProps: 'gridTemplateRows' }),
      },
    );
  }

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
      <span class={[dim && 'sec__title--dim']}>
        {#if icon}<i class="fa-solid fa-{icon} sec__icon" aria-hidden="true"></i>{/if}
        {title}
      </span>
      {#if name}<strong>{name}</strong>{/if}
    </button>
    {@render bar?.()}
  </div>
  <div class="sec__body" id="{uid}-body" inert={!isOpen} bind:this={body}>
    <div class="sec__clip">
      <div class="sec__inner">
        {@render children?.()}
      </div>
    </div>
  </div>
</section>

<style lang="scss">
  .sec {
    display: flex;
    flex-direction: column;
    padding: var(--space-3) var(--space-2);
    margin-inline: -8px;
    border: 1px solid transparent;
    background: var(--c-card);
    border-radius: var(--radius-lg);

    &:first-of-type {
      // border-top-color: transparent;
      // padding-top: 0;
    }
  }

  // the toggle, then on the right whatever the `bar` snippet adds; every item is 20px tall
  // (a toggle with a name has a second 20px line)
  .sec__bar {
    display: flex;
    align-items: flex-start;
    gap: var(--space-1);
    font-size: var(--fs-base);
    line-height: 20px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--c-text-dim);
    background: inherit;

    > :global(*) {
      flex: none;
    }

    // a changed-dot (8px) centered on the first line
    > :global(.dot) {
      margin: calc((1lh - 8px) / 2) 0;
    }
  }

  // a panel's own sections (not nested ones): the bar stays on top of the scroll area while
  // its section scrolls by, on the panel's color so the fields pass under it
  :global(.ed-body) > .sec > .sec__bar {
    position: sticky;
    top: -16px; // the scroll area's top edge, over its padding
    z-index: 1;
    margin: -8px 0;
    padding: var(--space-2) 0;
    // background: var(--c-surface);
  }

  // caret | title, with the name under the title
  .sec__toggle {
    flex: 1;
    min-width: 0;
    display: grid;
    grid-template-columns: 20px minmax(0, 1fr);
    column-gap: var(--space-1);
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    font: inherit;
    letter-spacing: inherit;
    text-transform: inherit;
    text-align: left;
    color: inherit;
    cursor: pointer;

    &:hover {
      color: var(--c-text-strong);
    }

    &:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 1px var(--c-accent);
    }

    // the name under the title, like .grp__title strong
    strong {
      grid-column: 2;
      font-weight: 400;
      color: var(--c-brand);
    }
  }

  // (display comes from Font Awesome's .fa-solid)
  .sec__caret {
    width: 20px;
    height: 20px;
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    line-height: 20px;
    text-align: center;
    transition: rotate 0.15s;

    [aria-expanded='true'] > & {
      rotate: 90deg;
    }
  }

  .sec__title--dim {
    color: var(--c-text-faint);
  }

  .sec__icon {
    width: 16px;
    margin-right: var(--space-1);
    text-align: center;
  }

  // the body's row: open 1fr, closed (inert) 0fr; the bar's gap is the inner's padding, so
  // it closes with it
  .sec__body {
    display: grid;
    grid-template-rows: 1fr;

    &[inert] {
      grid-template-rows: 0fr;
    }
  }

  .sec__clip {
    min-height: 0;
    overflow: hidden;
  }

  .sec__inner {
    padding-top: var(--space-3);
  }

  .sec__inner > :global(* + *) {
    margin-top: var(--space-3);
  }

  .sec.is-off {
    .sec__toggle {
      color: var(--c-text-muted);
    }

    .sec__body {
      opacity: 0.55;
    }
  }
</style>
