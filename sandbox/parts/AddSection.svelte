<!-- mock: "Add section" as a card under the section cards. variant: a | b | c; open: its menu -->
<script>
  import Section from '../../src/editor/svelte/Section.svelte';

  let { variant = 'a', open = false, caption = '' } = $props();
  const TYPES = [
    ['Empty section', 'square'], ['Page heading', 'heading'], ['Text', 'align-left'],
    ['Photo', 'image'], ['Button', 'arrow-right'], ['Contact form', 'envelope'], ['Hero', 'star'],
    ['Statement', 'quote-left'], ['Photo grid', 'table-cells'], ['Album cards', 'images'],
    ['Photo panels', 'table-columns'], ['Project list', 'list'], ['Bio', 'user'],
  ];
</script>

<div class="col">
  <p class="cap">{caption}</p>
  <div class="panel">
    <Section title="Section 1" name="Eeliya Rasta" open={false}>
      {#snippet bar()}<input type="checkbox" class="switch" checked aria-label="Show" />{/snippet}
    </Section>
    <Section title="Section 2" name="Statement">
      {#snippet bar()}<input type="checkbox" class="switch" checked aria-label="Show" />{/snippet}
      <div class="blk"><i class="fa-solid fa-grip-vertical"></i><span>Statement</span></div>
    </Section>

    <div class="addwrap">
      {#if variant === 'a'}
        <button type="button" class={['add add--a', open && 'is-open']} aria-haspopup="menu" aria-expanded={open}>
          <i class="fa-solid fa-plus" aria-hidden="true"></i>Add section
        </button>
      {:else if variant === 'b'}
        <button type="button" class={['add add--b', open && 'is-open']} aria-haspopup="menu" aria-expanded={open}>
          <i class="fa-solid fa-plus add__icon" aria-hidden="true"></i>Add section
        </button>
      {:else}
        <!-- (c) one click adds an empty section; the chevron picks one with a block in it -->
        <div class={['add add--c', open && 'is-open']}>
          <button type="button" class="add__main"><i class="fa-solid fa-plus add__icon" aria-hidden="true"></i>Add section</button>
          <button type="button" class="add__more" aria-label="Add a section with a block" aria-haspopup="menu" aria-expanded={open}><i class="fa-solid fa-chevron-down" aria-hidden="true"></i></button>
        </div>
      {/if}
      {#if open}
        <ul class="menu" role="menu">
          {#each TYPES.slice(variant === 'c' ? 1 : 0) as [label, icon], i (label)}
            <li role="menuitem" class={['menu__opt', i === 0 && 'is-active']}>
              <i class="fa-solid fa-{icon} menu__icon" aria-hidden="true"></i>{label}
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
</div>

<style lang="scss">
  .col { width: 384px; display: flex; flex-direction: column; gap: 12px; }
  .cap { margin: 0; min-height: 48px; color: var(--c-text-muted); font-size: var(--fs-sm); line-height: 16px; }
  // the editor's panel: the cards' -8px side margins sit inside its 8px padding
  .panel { display: flex; flex-direction: column; gap: 12px; padding: 0 8px; min-height: 620px; }
  .blk { display: flex; align-items: center; gap: 12px; height: 40px; padding: 0 12px; border-radius: var(--radius-md); background: var(--c-surface); color: var(--c-text); i { color: var(--c-text-faint); } }

  // the card: the section cards' width (-8px each side), radius and 12px gap; 40px tall
  .addwrap { position: relative; }
  .add {
    width: calc(100% + 16px);
    margin-inline: -8px;
    height: 40px;
    border-radius: var(--radius-lg);
    font: inherit;
    font-size: var(--fs-base);
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
  }
  .add__icon { width: 20px; text-align: center; font-size: var(--fs-xs); }

  // (a) a dashed outline, centred
  .add--a {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    border: 1px dashed var(--c-line-strong, var(--c-line));
    background: none;
    color: var(--c-text-dim);
    &:hover, &.is-open { color: var(--c-text-strong); border-color: var(--c-accent); }
  }

  // (b) a section card's background and bar: + where the caret is, the title's type
  .add--b {
    display: flex; align-items: center; gap: 4px;
    padding: 0 var(--space-2);
    border: 1px solid transparent;
    background: var(--c-card);
    color: var(--c-text-dim);
    text-align: left;
    &:hover, &.is-open { color: var(--c-text-strong); }
    &.is-open { border-color: var(--c-accent); }
  }

  // (c) b, split: Add section (an empty one) | ▾ (with a block)
  .add--c {
    display: flex; padding: 0; border: 1px solid transparent; background: var(--c-card); cursor: default;
    &.is-open { border-color: var(--c-accent); }
    button { font: inherit; letter-spacing: inherit; text-transform: inherit; color: var(--c-text-dim); background: none; border: 0; cursor: pointer; &:hover { color: var(--c-text-strong); } }
  }
  .add__main { flex: 1; display: flex; align-items: center; gap: 4px; padding: 0 var(--space-2); text-align: left; }
  .add__more { width: 40px; border-left: 1px solid var(--c-line) !important; font-size: var(--fs-xs); }

  // the menu: the editor's Select list (Select.svelte), below the card, its width
  .menu {
    position: absolute; left: -8px; right: -8px; top: 44px; z-index: 2;
    margin: 0; padding: var(--space-2); list-style: none;
    color: var(--c-text); background: var(--c-surface);
    box-shadow: inset 0 0 0 1px var(--c-focus-ring);
    border-radius: var(--radius-md);
  }
  .menu__opt {
    display: flex; align-items: center; gap: var(--space-3); height: 32px; padding: 0 var(--space-3);
    border-radius: var(--radius-md); cursor: pointer;
    &.is-active { box-shadow: inset 0 0 0 1px var(--c-accent); }
  }
  .menu__icon { width: 16px; text-align: center; color: var(--c-text-muted); }
</style>
