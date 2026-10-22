<!--
  A collapsible panel section: a bar (a toggle button with the title, the `bar` snippet's
  controls, then the caret at its right end) and the body, clipped and inert while closed (it stays in the DOM, so a field picked
  in the preview can be found and its section opened). Used by the Content, Motion and Settings
  tabs and the Animations library (with onenter, an always open card a click selects and a
  double click or its pen goes into: the page's section cards). .sec is a flex column: bar, body (.sec__body > .sec__clip > .sec__inner).

    title     the bar title (small caps)
    name      optional: what it is, on a second line in the accent color
              (Motion: "Section 2" / "Work")
    key       remembers open/closed in ui.sections (also kept across a refresh, persist.js),
              e.g. "settings:site"; without it the section just starts as `open`
    open      open when nothing is remembered yet (default true)
    id        data-section, to find the section (e.g. scroll to it)
    off       dimmed: the section is turned off
    changed   unsaved changes in it: an accent dot before the title (no layout shift)
    class     extra class on the section
    bar       snippet: controls at the right of the bar (count, buttons, a switch), each 20px tall
              (24px for a file button). A panel's own sections keep their bar on top while
              scrolling through them (sticky).
    children  the section body
    foot      optional: more body under the bar or body (a page section's widgets)
    stack     the bar in two rows: the title alone on the first (it wraps in full), the `bar`
              snippet's controls on a second, from the left edge
    danger    the card's border red (a delete confirm over it)
    over      snippet: drawn over the whole card at its size (a confirm), inside its border
    onenter   optional: the card doesn't collapse (always open, no caret, `key` and `open`
              unused; the title plain text, not a button) and goes into it (a page section's
              settings): a double click on the card, or its pen (pen-to-square, `enterLabel`)
              at the title row's right end, after the `bar` snippet's controls (24px, 2px over
              the 20px row: no height change). Such a card (data-card) dims only its title
              while `off`: its body's parts dim themselves (SectionCard.svelte)
    onselect  optional, with onenter: a click on the card selects it
    selected  its border white 70% (the selected card); hovered 40% (editor.scss)
              Neither a click nor a double click on its controls (buttons, switches, fields,
              links, a widget's row, a confirm) or while `danger`
  Opening and closing animate the body's grid row, 0fr to 1fr (GSAP, 0.25s power2.out): closed
  it is clipped away, still rendered but inert; none with prefers-reduced-motion.
-->
<script>
  import { untrack } from 'svelte';
  import { gsap } from 'gsap';
  import { ui } from './ui.svelte.js';
  import Button from './Button.svelte';

  let {
    title,
    name = '',
    key = '',
    open = true,
    id = null,
    off = false,
    changed = false,
    class: cls = '',
    bar,
    children,
    foot,
    stack = false,
    danger = false,
    over,
    onenter = null,
    onselect = null,
    selected = false,
    enterLabel = 'Edit',
  } = $props();

  const uid = $props.id();
  let toggled = $state(null); // open/closed of a section without a key
  const isOpen = $derived(!!onenter || ((key ? ui.sections[key] : toggled) ?? open));

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

  // a card (onenter): a click selects it, a double click goes in; not on its controls
  const CONTROLS =
    'a, button, input, select, textarea, label, [contenteditable], [data-row], [role="group"], [role="alertdialog"]';
  const free = (e) => !!onenter && !danger && !e.target.closest?.(CONTROLS);
  const pick = (e) => free(e) && onselect?.();
  const enter = (e) => free(e) && onenter();
  // no word selected by a double click on the card (its fields still select)
  const noSelect = (e) => e.detail > 1 && free(e) && e.preventDefault();
</script>

{#snippet head()}
  <span>{title}</span>
  {#if name}<strong>{name}</strong>{/if}
{/snippet}

<!-- a card's click and double click are pointer shortcuts: the keyboard has its pen and tools -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->

<section
  class={[
    'sec',
    off && 'is-off',
    changed && 'is-changed',
    stack && 'sec--stack',
    danger ? 'is-danger' : selected && 'is-selected',
    cls,
  ]}
  data-section={id}
  data-card={onenter ? '' : undefined}
  onclick={onenter && pick}
  ondblclick={onenter && enter}
  onmousedown={onenter && noSelect}
>
  <div class="sec__bar">
    {#if onenter}
      <span class="sec__toggle sec__toggle--card">{@render head()}</span>
    {:else}
      <button
        type="button"
        class="sec__toggle"
        aria-expanded={isOpen}
        aria-controls="{uid}-body"
        onclick={toggle}
      >
        {@render head()}
      </button>
    {/if}
    {@render bar?.()}
    {#if !onenter}
      <!-- the caret at the bar's right end: a pointer target (the title is the keyboard's) -->
      <button
        type="button"
        class={['sec__caret', isOpen && 'is-open']}
        tabindex="-1"
        aria-hidden="true"
        onclick={toggle}><i class="fa-solid fa-chevron-right"></i></button
      >
    {/if}
    {#if onenter}
      <span class="sec__enter"
        ><Button
          size="small"
          icon="pen-to-square"
          iconOnly
          label={enterLabel}
          onclick={onenter}
        /></span
      >
    {/if}
  </div>
  <div class="sec__body" id="{uid}-body" inert={!isOpen} bind:this={body}>
    <div class="sec__clip">
      <div class="sec__inner">
        {@render children?.()}
      </div>
      {#if foot}<div class="sec__foot">{@render foot()}</div>{/if}
    </div>
  </div>
  {@render over?.()}
</section>

<style lang="scss">
  @use '../styles/mixins' as *;

  .sec {
    display: flex;
    flex-direction: column;
    padding: var(--space-3) 0; // the sides: the bar's and the inner's (a foot's line is edge to edge)
    position: relative;
    border: 1px solid transparent;
    background: var(--c-card);
    border-radius: var(--radius-lg);

    // its own 1px border, red: no size change
    &.is-danger {
      border-color: var(--c-danger);
    }
  }

  // the toggle, then on the right whatever the `bar` snippet adds; every item is 20px tall
  // (a toggle with a name has a second 20px line)
  .sec__bar {
    display: flex;
    padding-inline: var(--space-2);
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
  }

  // a panel's own sections (not nested ones): the bar stays on top of the scroll area while
  // its section scrolls by, on the panel's color so the fields pass under it
  :global(.ed-body) > .sec > .sec__bar {
    position: sticky;
    top: -12px; // the scroll area's top edge, over its padding
    z-index: 1;
    margin: -8px 0;
    padding: var(--space-2);
  }

  // the title, with the name under it
  .sec__toggle {
    flex: 1;
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
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
      @include focus-ring;
    }

    // a card's title: plain text (no caret, not a button), its colour never changes
    &.sec__toggle--card {
      cursor: default;

      &:hover {
        color: inherit;
      }
    }

    // the name under the title, like .grp__title strong
    strong {
      font-weight: 400;
      color: var(--c-brand);
    }
  }

  // the caret: the bar's last item, an 8px column at its right end (the bar's 8px inset: the
  // fields' right edge); right closed, down open
  .sec__caret {
    display: grid;
    place-items: center;
    width: 8px;
    height: 20px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    cursor: pointer;

    > i {
      transition: rotate 0.15s;
    }

    &.is-open > i {
      rotate: 90deg;
    }

    .sec__toggle:hover ~ &,
    &:hover {
      color: var(--c-text-strong);
    }
  }

  // a card's pen at the title row's right end: 24px centred in a 20px slot, 2px over above
  // and below (the row keeps its height)
  .sec__enter {
    display: flex;
    align-items: center;
    height: 20px;
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

  // its parts a column with gaps (not margins on them: a part keeps its own margins)
  .sec__inner {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-2) 0;
  }

  .sec__foot {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin-top: var(--space-4);
    padding: var(--space-3) var(--space-2) 0;
  }

  // no body (a list card: its widgets only): the foot right under the bar
  .sec__inner:empty {
    display: none;
  }

  .sec__inner:empty + .sec__foot {
    margin-top: 0;
  }

  // two rows: the title alone (wraps), then the controls from the left
  .sec--stack > .sec__bar {
    flex-wrap: wrap;
    row-gap: var(--space-2);

    > .sec__toggle {
      flex: 1 0 100%;
    }
  }

  // the changed dot first: the title takes the rest of its row
  .sec--stack.is-changed > .sec__bar > .sec__toggle {
    flex-basis: calc(100% - var(--size-changed) - var(--space-1));
  }

  // a card's pen after the title, on its row (the dot's and the pen's room taken off)
  .sec--stack > .sec__bar > .sec__toggle--card {
    flex-basis: calc(100% - 24px - var(--space-1));
  }

  .sec--stack.is-changed > .sec__bar > .sec__toggle--card {
    flex-basis: calc(100% - var(--size-changed) - 24px - var(--space-2));
  }

  .sec.is-off {
    .sec__toggle {
      color: var(--c-text-muted);
    }

    &:not([data-card]) .sec__body {
      opacity: var(--o-dim);
    }
  }
</style>
