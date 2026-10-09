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
