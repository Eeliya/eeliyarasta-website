<!--
  Page picker in the toolbar. A page navigates the preview; a component (Menu, Footer)
  keeps the page and switches the Content tab to its fields. Opens on click.
-->
<script>
  import { tick } from 'svelte';

  // items: [{ kind: 'page', path, title } | { kind: 'component', id, title }]
  // value: the current item; onchange(item): an item was picked
  let { items, value, onchange } = $props();

  let open = $state(false);
  let menu = $state();
  let button = $state();

  const key = (item) =>
    item?.kind === 'component' ? `component:${item.id}` : `page:${item?.path}`;
  const kindName = (item) => (item?.kind === 'component' ? 'Component' : 'Page');
  const groups = $derived(
    [
      ['Pages', items.filter((i) => i.kind === 'page')],
      ['Components', items.filter((i) => i.kind === 'component')],
    ].filter(([, list]) => list.length),
  );

  async function toggle() {
    open = !open;
    if (!open) return;
    await tick();
    const options = menu.querySelectorAll('[role="option"]');
    (menu.querySelector('[aria-selected="true"]') || options[0])?.focus();
  }

  function close() {
    open = false;
    button.focus();
  }

  function pick(item) {
    open = false;
    onchange(item);
  }

  /** Arrow keys, Home and End move between options; Enter or Space picks one. */
  function onOptionKey(e, item) {
    const options = [...menu.querySelectorAll('[role="option"]')];
    const i = options.indexOf(e.currentTarget);
    const to = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: options.length - 1 }[e.key];
    if (to !== undefined) {
      e.preventDefault();
      options.at(to % options.length).focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick(item);
    }
  }
</script>

<svelte:document
  onclick={(e) => open && !menu.contains(e.target) && (open = false)}
  onkeydown={(e) => open && e.key === 'Escape' && close()}
/>

<div class="pm" bind:this={menu}>
  <button
    type="button"
    class="pm__btn"
    aria-haspopup="listbox"
    aria-expanded={open}
    bind:this={button}
    onclick={toggle}
  >
    <span class="pm__kind" data-kind={value?.kind}>{kindName(value)}</span>
    <span class="pm__label">{value?.title}</span>
    <i class="fa-solid fa-chevron-down pm__caret" aria-hidden="true"></i>
  </button>

  {#if open}
    <ul class="pm__list" role="listbox">
      {#each groups as [title, list] (title)}
        <li class="pm__group" role="presentation">{title}</li>
        {#each list as item (key(item))}
          <li
            role="option"
            tabindex="-1"
            class={['pm__opt', key(item) === key(value) && 'is-active']}
            aria-selected={key(item) === key(value)}
            onclick={() => pick(item)}
            onkeydown={(e) => onOptionKey(e, item)}
          >
            <span class={['pm__badge', item.kind === 'component' && 'is-component']}>
              {kindName(item)}
            </span>
            <span class="pm__opt-title">{item.title}</span>
            {#if item.path}<span class="pm__opt-path">{item.path}</span>{/if}
          </li>
        {/each}
      {/each}
    </ul>
  {/if}
</div>

<style lang="scss">
  // custom page / component picker
  .pm {
    position: relative;
    flex: 1;
    min-width: 0;
  }

  .pm__btn {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 8px 12px;
    border: 0;
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    background: rgb(0 0 0 / 0.35);
    box-shadow: inset 0 0 0 1px var(--line);

    &:hover,
    &[aria-expanded='true'] {
      box-shadow: inset 0 0 0 1px rgb(159 211 255 / 0.45);
    }
  }

  .pm__kind {
    flex: none;
    font-size: 9px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 4px 8px;
    border-radius: 999px;
    color: var(--faint);
    box-shadow: inset 0 0 0 1px var(--line);

    &[data-kind='component'] {
      color: #e6dcc4;
      box-shadow: inset 0 0 0 1px rgb(230 220 196 / 0.35);
    }
  }

  .pm__label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--fg);
  }

  .pm__caret {
    flex: none;
    color: var(--muted);
    font-size: 10px;
  }

  .pm__list {
    position: absolute;
    z-index: 20;
    top: calc(100% + 8px);
    left: 0;
    right: 0;
    max-height: min(360px, 50vh);
    overflow: auto;
    margin: 0;
    padding: 8px;
    list-style: none;
    border-radius: 12px;
    background: rgb(22 22 22 / 0.92);
    -webkit-backdrop-filter: blur(20px) saturate(160%);
    backdrop-filter: blur(20px) saturate(160%);
    box-shadow:
      inset 0 0 0 1px rgb(255 255 255 / 0.1),
      0 24px 50px -20px rgb(0 0 0 / 0.9);
  }

  .pm__group {
    padding: 8px 12px 4px;
    font-size: 9.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--faint);
  }

  .pm__opt {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
    align-items: center;
    padding: 8px 12px;
    border-radius: 8px;
    cursor: pointer;
    outline: none;

    &:hover,
    &:focus-visible {
      background: rgb(255 255 255 / 0.08);
    }

    &.is-active {
      background: color-mix(in srgb, var(--ed-accent) 12%, transparent);
    }
  }

  .pm__badge {
    grid-row: 1 / span 2;
    font-size: 9px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 4px 8px;
    border-radius: 999px;
    color: var(--faint);
    box-shadow: inset 0 0 0 1px var(--line);

    &.is-component {
      color: #e6dcc4;
      box-shadow: inset 0 0 0 1px rgb(230 220 196 / 0.35);
    }
  }

  .pm__opt-title {
    color: var(--fg);
  }

  .pm__opt-path {
    grid-column: 2;
    font-size: 10.5px;
    color: var(--muted);
  }
</style>
