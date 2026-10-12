<!-- mock: the block card's tabs (Content / Layout / Motion) as real tabs. v: now | a | b | c -->
<script>
  let { v = 'now', caption = '' } = $props();
  const TABS = ['Content', 'Layout', 'Motion'];
</script>

<div class="col">
  <p class="cap">{caption}</p>
  <div class="bcard">
    <div class="head"><span>Statement</span></div>
    <div class={['tabs', `tabs--${v}`, v === 'now' && 'seg']} role="tablist">
      {#each TABS as t, i (t)}
        <button type="button" role="tab" data-text={t}
          class={['tab', v === 'now' && 'seg__btn', i === 0 && 'is-active']}>{t}</button>
      {/each}
    </div>
    <div class={['panel', `panel--${v}`]}>
      <div class="sc">
        <span class="sc__tile"><i class="fa-solid fa-plus"></i></span>
        <span class="sc__text"><span class="sc__label">Source item</span><span class="sc__name">No item</span></span>
        <span class="choose">Choose</span>
      </div>
      <label class="tf">
        <span class="tf__label">Text</span>
        <textarea class="tf__input" rows="3">I photograph people where they feel most themselves: at home, at work, outside.</textarea>
      </label>
    </div>
  </div>
</div>

<style lang="scss">
  .col { width: 360px; display: flex; flex-direction: column; gap: 12px; }
  .cap { margin: 0; min-height: 32px; color: var(--c-text-muted); font-size: var(--fs-sm); line-height: 16px; }
  .bcard { padding: 12px; border-radius: var(--radius-lg); background: var(--c-card); }
  .head { margin-bottom: 12px; line-height: 20px; color: var(--c-text-strong); }
  .panel { display: flex; flex-direction: column; gap: 16px; }

  // the source card as built (ItemPicker.svelte)
  .sc { display: flex; align-items: center; gap: 12px; padding: 8px; border-radius: var(--radius-md);
    background: var(--c-input); box-shadow: inset 0 0 0 1px var(--c-line); }
  .sc__tile { display: grid; place-items: center; flex: none; width: 48px; height: 48px;
    border-radius: var(--radius-md); background: var(--c-switch); color: var(--c-text-faint); }
  .sc__text { display: grid; flex: 1; line-height: 16px; }
  .sc__label { color: var(--c-text-muted); font-size: var(--fs-sm); }
  .sc__name { color: var(--c-text-muted); }
  .choose { padding: 0 12px; height: 32px; line-height: 32px; border-radius: var(--radius-pill);
    background: var(--c-switch); font-size: var(--fs-sm); text-transform: uppercase; letter-spacing: 0.06em; }
  .tf { display: block; }
  .tf__input { width: 100%; }

  .tabs { display: flex; margin-bottom: 16px; }
  .tabs--now .tab { flex: 1; }

  // all three: the same weight, or the bold width reserved; the tab shape never changes
  .tabs:not(.tabs--now) .tab {
    height: 32px; padding: 0 12px; border: 0; background: none; cursor: pointer;
    font-size: var(--fs-sm); letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--c-text-muted); line-height: 16px;
    &:hover { color: var(--c-text); }
    &.is-active { color: var(--c-text-strong); }
  }

  // a: underline tabs over a full-width 1px line
  .tabs--a { box-shadow: inset 0 -1px 0 var(--c-line); }
  .tabs--a .tab.is-active { box-shadow: inset 0 -2px 0 var(--c-accent); }

  // b: folder tabs joined to the panel under them
  .tabs--b { margin-bottom: 0; gap: 4px; padding-left: 8px; }
  .tabs--b .tab {
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    box-shadow: inset 0 0 0 1px transparent;
    &.is-active { position: relative; z-index: 1; margin-bottom: -1px; height: 33px; background: var(--c-input);
      box-shadow: inset 1px 1px 0 var(--c-line), inset -1px 0 0 var(--c-line); }
  }
  .tabs--b { align-items: flex-end; }
  .panel--b { padding: 12px; border-radius: var(--radius-md); background: var(--c-input);
    box-shadow: inset 0 0 0 1px var(--c-line); }
  .panel--b .sc { background: var(--c-card); }

  // c: plain text tabs, the active one white and bold; its bold width reserved (a hidden bold copy)
  .tabs--c { gap: 16px; }
  .tabs--c .tab {
    padding: 0; display: inline-grid;
    &::after { content: attr(data-text); height: 0; visibility: hidden; overflow: hidden; font-weight: 700; }
    &.is-active { font-weight: 700; }
  }
</style>
