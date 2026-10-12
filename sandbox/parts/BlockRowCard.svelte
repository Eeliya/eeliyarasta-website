<!--
  A page section card (the real Section and Button) with block rows in one of the block-row
  variants (sandbox/mocks/block-row-*.svelte):
    A  ⋯ menu with move / duplicate / delete; only the switch stays
    B  the actions hidden until hover, over the end of the title (hover: shown as hovered)
    C  two lines: type and actions on top, the title under them at full width
    D  a drag handle on the left, a ⋯ menu (duplicate / delete), the switch
  menu: the first row's menu open (A, D).
-->
<script>
  import SectionIcon from '../../src/editor/svelte/SectionIcon.svelte';
  import Section from '../../src/editor/svelte/Section.svelte';
  import Button from '../../src/editor/svelte/Button.svelte';

  let { variant = 'A', menu = false, hover = false } = $props();

  const rows = [
    { icon: 'table-cells', type: 'Photo grid', name: "Models I've worked with" },
    { icon: 'star', type: 'Hero', name: 'Eeliya Rasta' },
  ];
  const HEIGHTS = [
    ['custom', 'height', 'rows'],
    ['fit', 'height', 0],
    ['third', 'height', 1 / 3],
    ['half', 'height', 1 / 2],
    ['full', 'height', 1],
  ];
  const WIDTHS = [
    ['contained', 'width', 'inside'],
    ['full', 'width', 'edge'],
  ];
  const sectionBar = [
    ['location-crosshairs', 'Show in preview'],
    ['arrow-up', 'Move up'],
    ['arrow-down', 'Move down'],
    ['copy', 'Duplicate'],
    ['trash', 'Delete'],
  ];
</script>

{#snippet actions(r, j)}
  {#if variant !== 'E'}
    <Button size="small" icon="arrow-up" iconOnly label="Move {r.type} up" disabled={j === 0} />
    <Button size="small" icon="arrow-down" iconOnly label="Move {r.type} down" disabled={j === 1} />
  {/if}
  <Button size="small" icon="copy" iconOnly label="Duplicate {r.type}" />
  <Button size="small" icon="trash" iconOnly label="Delete {r.type}" />
{/snippet}

{#snippet more(r, j, moves)}
  <span class="more">
    <Button
      size="small"
      icon="ellipsis"
      iconOnly
      label="More: {r.type}"
      aria-pressed={menu && j === 0}
    />
    {#if menu && j === 0}
      <div class="menu" role="menu">
        {#if moves}
          <button type="button" role="menuitem" disabled
            ><i class="fa-solid fa-arrow-up" aria-hidden="true"></i>Move up</button
          >
          <button type="button" role="menuitem"
            ><i class="fa-solid fa-arrow-down" aria-hidden="true"></i>Move down</button
          >
        {/if}
        <button type="button" role="menuitem"
          ><i class="fa-solid fa-copy" aria-hidden="true"></i>Duplicate</button
        >
        <button type="button" role="menuitem" class="is-danger"
          ><i class="fa-solid fa-trash" aria-hidden="true"></i>Delete</button
        >
      </div>
    {/if}
  </span>
{/snippet}

<Section title="Section 3" dim>
  {#snippet bar()}
    {#each sectionBar as [icon, label] (icon)}
      <Button size="small" {icon} iconOnly {label} />
    {/each}
    <input type="checkbox" class="switch" aria-label="Show section 3" checked />
  {/snippet}
  <div class="fields">
    <div class="tf">
      <input class="tf__input" placeholder="Name" aria-label="Name" />
      <span class="tf__help hint">Optional: a #link to this section</span>
    </div>
    {#each [['Height', HEIGHTS, 'fit'], ['Width', WIDTHS, 'contained']] as [title, opts, now] (title)}
      <div class="tf is-half">
        <span class="tf__label">{title}</span>
        <div class="hset" role="radiogroup">
          {#each opts as [value, kind, arg] (value)}
            <button type="button" class={['hset__btn', now === value && 'is-active']}>
              <SectionIcon {kind} {arg} />
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </div>
  <ul class="blocks">
    {#each rows as r, j (r.type)}
      <li class={['block', hover && j === 0 && 'is-hover']}>
        {#if variant === 'D'}
          <span class="grip" title="Drag to reorder"
            ><i class="fa-solid fa-grip-vertical" aria-hidden="true"></i></span
          >
        {/if}
        {#if variant === 'C' || variant === 'E'}
          <div class="two">
            <div class="top">
              <button type="button" class="open">
                {#if variant === 'C'}<i class="fa-solid fa-{r.icon}" aria-hidden="true"></i>{/if}<span>{r.type}</span>
              </button>
              {@render actions(r, j)}
              <input type="checkbox" class="switch" aria-label="Show {r.type}" checked />
            </div>
            <button type="button" class="title">{r.name}</button>
          </div>
        {:else}
          <button type="button" class="open">
            {#if variant !== 'D'}<i class="fa-solid fa-{r.icon}" aria-hidden="true"></i>{/if}
            <span>{r.type}</span>
            <strong>{r.name}</strong>
          </button>
          {#if variant === 'B'}
            <span class="over">{@render actions(r, j)}</span>
          {:else}
            {@render more(r, j, variant === 'A')}
          {/if}
          <input type="checkbox" class="switch" aria-label="Show {r.type}" checked />
        {/if}
      </li>
    {/each}
  </ul>
</Section>

<style lang="scss">
  // as SectionsList.svelte's block rows
  .fields {
    margin-bottom: var(--space-3);
    padding-bottom: var(--space-3);
  }


  .hint {
    text-align: right;
  }

  .hset {
    display: flex;
    gap: var(--space-1);
    height: var(--size-control);
    padding: var(--space-1);
    border-radius: var(--radius-md);
    box-shadow: inset 0 0 0 1px var(--c-line);
    justify-self: start;
  }

  .hset__btn {
    display: grid;
    flex: 1;
    place-items: center;
    width: 36px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--c-text-muted);

    &.is-active {
      background: var(--c-fill-active);
      color: var(--c-accent);
    }
  }

  // the divider: edge to edge across the card (out over its side padding)
  .blocks {
    display: grid;
    gap: var(--space-2);
    margin-inline: calc(-1 * var(--space-2)) !important;
    padding: var(--space-3) var(--space-2) 0 !important;
    border-top: 1px solid var(--c-line);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .block {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-1);
    min-height: var(--size-control);
    padding-right: var(--space-1);
    border-radius: var(--radius-md);
    background: var(--c-surface-2);

    &:hover,
    &.is-hover {
      background: var(--c-surface-3);
    }
  }

  .open {
    display: flex;
    flex: 1;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    height: var(--size-control);
    padding: 0 var(--space-2);
    border: 0;
    background: none;
    color: var(--c-text);
    font: inherit;
    font-size: var(--fs-base);
    text-align: left;

    span {
      flex: none;
    }

    strong {
      overflow: hidden;
      color: var(--c-link);
      font-weight: 400;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    i {
      width: 16px;
      color: var(--c-text-muted);
      text-align: center;
    }
  }

  // B: the actions over the end of the title, on the hovered row's color (solid)
  .over {
    position: absolute;
    top: 0;
    right: 48px;
    display: none;
    align-items: center;
    height: var(--size-control);
    padding-left: var(--space-2);
    background: var(--c-surface-3);

    .block:hover &,
    .is-hover & {
      display: flex;
    }
  }

  // C
  .two {
    display: grid;
    flex: 1;
    min-width: 0;
  }

  .top {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .title {
    margin-top: calc(-1 * var(--space-2));
    padding: 0 var(--space-2) var(--space-2);
    border: 0;
    background: none;
    color: var(--c-link);
    font: inherit;
    font-size: var(--fs-base);
    text-align: left;
  }

  // D
  .grip {
    display: grid;
    place-items: center;
    width: 20px;
    height: var(--size-control);
    margin-right: calc(-1 * var(--space-2));
    color: var(--c-text-faint);
    font-size: var(--fs-sm);
    cursor: grab;
  }

  // A, D: the ⋯ menu
  .more {
    position: relative;
    display: flex;
  }

  .menu {
    position: absolute;
    top: calc(100% + var(--space-1));
    right: 0;
    z-index: 5;
    display: grid;
    min-width: 160px;
    padding: var(--space-1);
    border-radius: var(--radius-lg);
    background: var(--c-card);
    box-shadow:
      inset 0 0 0 1px var(--c-fill-active),
      0 12px 32px -12px var(--c-scrim);

    button {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      height: var(--size-control);
      padding: 0 var(--space-2);
      border: 0;
      border-radius: var(--radius-md);
      background: none;
      color: var(--c-text);
      font: inherit;
      font-size: var(--fs-base);
      text-align: left;

      i {
        width: 16px;
        color: var(--c-text-muted);
        text-align: center;
      }

      &:hover:not(:disabled) {
        background: var(--c-surface-3);
      }

      &:disabled,
      &:disabled i {
        color: var(--c-text-faint);
      }

      &.is-danger,
      &.is-danger i {
        color: var(--c-danger-hover);
      }
    }
  }

  // the divider reaches over the card's side padding (clip, with a margin as wide)
  :global(.sec__clip) {
    overflow: visible !important;
  }

  // the open menu reaches out of the card
  :global(.sec__clip:has(.menu)) {
    overflow: visible;
  }
</style>
