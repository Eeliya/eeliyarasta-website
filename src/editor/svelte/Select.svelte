<!--
  A dropdown instead of the native <select>: a button (role combobox) and a listbox in the top
  layer (a popover, so no panel or dialog clips it). Focus stays on the button; the active option
  is aria-activedescendant. Keys: Up/Down, Home/End, Enter/Space pick, Esc/Tab close, typing jumps.
  Props:
    value        the picked option's value: bind:value, or a value the parent updates on onchange
    options      [{ value, label, hint?, disabled? }], or groups [{ group, options: [...] }]
    placeholder  shown when no option has the value
    id           for <label for>; aria-label when there is no label
    onchange     (value, option) on a pick; with it the parent owns the value
    option       snippet (option) for an option's content; default: label + hint
    selected     snippet (option) for the button's content; default: label
-->
<script>
  import { untrack } from 'svelte';

  let {
    value = $bindable(),
    options = [],
    placeholder = '',
    id,
    'aria-label': ariaLabel,
    onchange,
    option: optionSnippet,
    selected: selectedSnippet,
  } = $props();

  const uid = $props.id();
  const listId = `${uid}-list`;

  let open = $state(false);
  let active = $state(-1); // index into flat
  let up = $state(false);
  let button = $state();

  const groups = $derived(options.some((o) => o.options) ? options : [{ group: '', options }]);
  const flat = $derived(groups.flatMap((g) => g.options));
  const current = $derived(flat.find((o) => o.value === value));
  const optionId = (i) => `${uid}-${i}`;

  /** Runs once when the list opens; untrack so hovering (which changes `active`) doesn't rerun it. */
  function show(list) {
    untrack(() => {
      list.showPopover();
      const r = button.getBoundingClientRect();
      const below = innerHeight - r.bottom - 8;
      up = below < Math.min(list.scrollHeight, 240) && r.top - 8 > below;
      place(list);
      reveal(active);
    });
  }

  /** Under the button (over it when up), as wide, at most as tall as the room there. */
  function place(list = document.getElementById(listId)) {
    if (!list) return;
    const r = button.getBoundingClientRect();
    Object.assign(list.style, {
      left: `${r.left}px`,
      width: `${r.width}px`,
      top: up ? 'auto' : `${r.bottom}px`,
      bottom: up ? `${innerHeight - r.top}px` : 'auto',
      maxHeight: `${Math.min(360, up ? r.top - 8 : innerHeight - r.bottom - 8)}px`,
    });
  }

  function openList(at = flat.indexOf(current)) {
    active = at >= 0 ? at : next(-1, 1);
    open = true;
  }

  function pick(i) {
    const o = flat[i];
    open = false;
    if (!o || o.disabled) return;
    if (o.value === value) return;
    if (onchange) onchange(o.value, o);
    else value = o.value;
  }

  /** The next enabled option from i in direction dir (wraps around). */
  function next(i, dir) {
    for (let n = 1; n <= flat.length; n++) {
      const j = (i + dir * n + flat.length * n) % flat.length;
      if (!flat[j].disabled) return j;
    }
    return -1;
  }

  function hover(li) {
    const i = Number(li?.dataset.i);
    if (li && !flat[i].disabled) active = i;
  }

  function moveTo(i) {
    active = i;
    reveal(i);
  }

  /** Scrolls the list (only the list: scrollIntoView would scroll the panel too) to option i. */
  function reveal(i) {
    const li = document.getElementById(optionId(i));
    const list = li?.parentElement;
    if (!li) return;
    if (li.offsetTop < list.scrollTop) list.scrollTop = li.offsetTop - 8;
    else if (li.offsetTop + li.offsetHeight > list.scrollTop + list.clientHeight)
      list.scrollTop = li.offsetTop + li.offsetHeight - list.clientHeight + 8;
  }

  let typed = '';
  let typedAt = 0;
  /** Type-ahead: the next option whose label starts with what was typed in the last 0.5s. */
  function typeAhead(key) {
    typed = (Date.now() - typedAt > 500 ? '' : typed) + key.toLowerCase();
    typedAt = Date.now();
    const from = typed.length === 1 ? active : active - 1;
    for (let n = 1; n <= flat.length; n++) {
      const j = (from + n) % flat.length;
      if (!flat[j].disabled && String(flat[j].label).toLowerCase().startsWith(typed)) return j;
    }
    return -1;
  }

  function onkeydown(e) {
    const { key } = e;
    if (key.length === 1 && key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const j = typeAhead(key);
      if (j < 0) return;
      e.preventDefault();
      if (open) moveTo(j);
      else openList(j);
      return;
    }
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(key)) {
        e.preventDefault();
        openList();
      } else if (key === 'Home' || key === 'End') {
        e.preventDefault();
        openList(key === 'Home' ? next(-1, 1) : next(flat.length, -1));
      }
      return;
    }
    const to = {
      ArrowDown: () => next(active, 1),
      ArrowUp: () => next(active, -1),
      Home: () => next(-1, 1),
      End: () => next(flat.length, -1),
    }[key];
    if (to) {
      e.preventDefault();
      moveTo(to());
    } else if (key === 'Enter' || key === ' ') {
      e.preventDefault();
      pick(active);
    } else if (key === 'Escape') {
      // close the list only: not the dialog or the editor's selection
      e.preventDefault();
      e.stopPropagation();
      open = false;
    } else if (key === 'Tab') {
      open = false;
    }
  }
</script>

<svelte:window
  onresize={() => (open = false)}
  onscrollcapture={(e) => open && !e.target.closest?.('[role="listbox"]') && place()}
/>

<button
  type="button"
  class={['sel', open && (up ? 'is-up' : 'is-down')]}
  {id}
  role="combobox"
  aria-label={ariaLabel}
  aria-haspopup="listbox"
  aria-expanded={open}
  aria-controls={listId}
  aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
  bind:this={button}
  onclick={() => (open ? (open = false) : openList())}
  {onkeydown}
  onblur={() => (open = false)}
>
  <span class={['sel__value', !current && 'is-placeholder']}>
    {#if current && selectedSnippet}{@render selectedSnippet(current)}{:else}{current?.label ??
        placeholder}{/if}
  </span>
  <i class="fa-solid fa-chevron-down sel__caret" aria-hidden="true"></i>
</button>

{#if open}
  <!-- The button keeps the focus (a press on the list doesn't take it) and handles the keys. -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <ul
    class="sel__list"
    id={listId}
    role="listbox"
    popover="manual"
    {@attach show}
    onpointerdown={(e) => e.preventDefault()}
    onpointermove={(e) => hover(e.target.closest('[role="option"]'))}
    onclick={(e) => {
      const li = e.target.closest('[role="option"]');
      if (li) pick(Number(li.dataset.i));
    }}
  >
    {#each groups as g, gi (gi)}
      {#if g.group}<li class="sel__group" role="presentation">{g.group}</li>{/if}
      {#each g.options as o (o.value)}
        {@const i = flat.indexOf(o)}
        <li
          id={optionId(i)}
          role="option"
          class={['sel__opt', i === active && 'is-active']}
          aria-selected={o.value === value}
          aria-disabled={o.disabled || undefined}
          data-i={i}
        >
          {#if optionSnippet}{@render optionSnippet(o)}{:else}
            {o.label}{#if o.hint}<span class="sel__hint">{o.hint}</span>{/if}
          {/if}
        </li>
      {/each}
    {/each}
  </ul>
{/if}

<style lang="scss">
  .sel {
    flex: 1 1 auto;
    width: 100%;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border: 0;
    border-radius: 8px;
    line-height: 16px;
    text-align: left;
    cursor: pointer;
    background: rgb(0 0 0 / 0.35);
    box-shadow: inset 0 0 0 1px var(--line);
    outline: none;
    transition: box-shadow 0.2s;

    &:hover {
      box-shadow: inset 0 0 0 1px rgb(159 211 255 / 0.45);
    }

    &:focus-visible {
      box-shadow:
        inset 0 0 0 1px var(--ed-accent),
        0 0 0 3px color-mix(in srgb, var(--ed-accent) 12%, transparent);
    }

    &.is-down {
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
    }

    &.is-up {
      border-top-left-radius: 0;
      border-top-right-radius: 0;
    }
  }

  .sel__value {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &.is-placeholder {
      color: var(--muted);
    }
  }

  .sel__caret {
    flex: none;
    color: var(--muted);
    font-size: 10px;
  }

  // the list: in the top layer, placed under (or over) the button by show()
  .sel__list {
    position: fixed;
    inset: auto;
    margin: 0;
    padding: 8px;
    border: 0;
    list-style: none;
    overflow: auto;
    overscroll-behavior: contain;
    color: var(--fg);
    background: var(--bg-2);
    box-shadow: inset 0 0 0 1px rgb(159 211 255 / 0.45);
    border-radius: 0 0 8px 8px;
    font: 400 12px/16px var(--f-mono);
    scrollbar-width: thin;
    scrollbar-color: rgb(255 255 255 / 0.2) transparent;
  }

  .is-up + .sel__list {
    border-radius: 8px 8px 0 0;
  }

  .sel__group {
    padding: 8px 12px 4px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--faint);
  }

  .sel__opt {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 8px 12px;
    border-radius: 8px;
    cursor: pointer;

    &[aria-selected='true'] {
      background: color-mix(in srgb, var(--ed-accent) 12%, var(--bg-2));
    }

    &.is-active {
      box-shadow: inset 0 0 0 1px var(--ed-accent);
    }

    &[aria-disabled='true'] {
      opacity: 0.35;
      cursor: default;
    }
  }

  .sel__hint {
    margin-left: auto;
    color: var(--muted);
  }
</style>
