<!-- mock: the photo field and the Photos list as source-style cards (64px, input look). v: a | b | c -->
<script>
  import Button from '../../src/editor/svelte/Button.svelte';
  let { v = 'a', caption = '' } = $props();
  const P = [
    ['/media/people/noor-vermeer/01.jpg', '01.jpg', '1280×1600 · 2 sizes · local'],
    ['/media/people/daan-okafor/02.jpg', '02.jpg', '1600×1067 · 3 sizes · R2'],
  ];
</script>

{#snippet card(p, label, list)}
  <div class={['pc', `pc--${v}`, !p && 'is-empty']}>
    {#if list && v !== 'a'}<span class="grip" title="Drag to reorder"><i class="fa-solid fa-grip-vertical"></i></span>{/if}
    {#if list && v === 'a'}<span class="grip" title="Drag to reorder"><i class="fa-solid fa-grip-vertical"></i></span>{/if}
    {#if p}<img class="pc__tile" src={p[0]} alt="" />{:else}<span class="pc__tile"><i class="fa-solid fa-plus"></i></span>{/if}
    <span class="pc__text">
      <span class="pc__label">{label}</span>
      <span class="pc__name">{p ? p[1] : 'No photo'}</span>
      {#if p}<span class="pc__meta">{p[2]}</span>{/if}
    </span>
    {#if v === 'a'}
      <Button size="small" variant={p ? 'primary' : 'default'}>{p ? 'Change' : 'Choose'}</Button>
      {#if list}<Button icon="xmark" iconOnly label="Remove" />{/if}
    {:else if v === 'b'}
      {#if p}<Button icon="images" iconOnly label="Change in Media" />{:else}<Button icon="images" iconOnly label="Choose in Media" />{/if}
      {#if p || list}<Button icon="xmark" iconOnly label="Remove" />{/if}
    {:else}
      {#if p || list}<Button icon="xmark" iconOnly label="Remove" />{/if}
      <i class="fa-solid fa-chevron-right pc__enter" aria-hidden="true"></i>
    {/if}
  </div>
{/snippet}

<div class="col">
  <p class="cap">{caption}</p>
  {#each [false, true] as filled (filled)}
    <div class="bcard">
      <span class="state">{filled ? 'Filled' : 'Empty'}</span>
      {@render card(filled ? P[0] : null, 'Cover photo', false)}
      <div class="lf">
        <span class="tf__label">Photos</span>
        {#if filled}
          {#each P as p, i (i)}{@render card(p, `Photo ${i + 1}`, true)}{/each}
        {/if}
        <Button size="small" icon="plus">Add photo</Button>
      </div>
    </div>
  {/each}
  <p class="note">Delete (a file in Media) stays the solid red pill:</p>
  <div><Button size="small" variant="danger" icon="trash">Delete</Button></div>
</div>

<style lang="scss">
  .col { width: 360px; display: flex; flex-direction: column; gap: 12px; }
  .cap, .note { margin: 0; min-height: 32px; color: var(--c-text-muted); font-size: var(--fs-sm); line-height: 16px; }
  .note { min-height: 0; }
  .bcard { display: flex; flex-direction: column; gap: 16px; padding: 12px; border-radius: var(--radius-lg); background: var(--c-card); }
  .state { color: var(--c-text-faint); font-size: var(--fs-sm); line-height: 16px; text-transform: uppercase; letter-spacing: 0.06em; }
  .lf { display: flex; flex-direction: column; gap: 8px; align-items: stretch; }
  .lf > :global(.btn) { align-self: flex-start; }
  .lf .tf__label { margin: 0; }

  // the card: as the source card (ItemPicker.svelte), 64px in every state
  .pc {
    display: flex; align-items: center; gap: 12px; height: 64px; padding: 8px;
    border-radius: var(--radius-md); background: var(--c-input); box-shadow: inset 0 0 0 1px var(--c-line);
    cursor: pointer;
    &:hover { background: var(--c-card-peek); }
  }
  .pc__tile {
    display: grid; place-items: center; flex: none; width: 48px; height: 48px;
    border-radius: var(--radius-md); background: var(--c-switch); color: var(--c-text-faint);
    object-fit: cover;
  }
  .pc__text { display: grid; flex: 1; min-width: 0; line-height: 16px; }
  .pc__label { color: var(--c-text-muted); font-size: var(--fs-sm); }
  .pc__name { color: var(--c-text-strong); font-weight: 500; .is-empty & { color: var(--c-text-muted); font-weight: 400; } }
  .pc__meta { color: var(--c-text-muted); font-size: var(--fs-sm); }
  .pc__label, .pc__name, .pc__meta { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .grip { display: grid; place-items: center; flex: none; width: 16px; height: 32px; margin-right: -4px; color: var(--c-text-faint); cursor: grab; }
  .pc__enter { flex: none; width: 16px; color: var(--c-text-faint); text-align: center; }

  // b: the photo fills the card's height (64px, edge to edge on the left)
  .pc--b { padding-left: 0; }
  .pc--b .pc__tile { width: 64px; height: 64px; margin-block: -8px; border-radius: var(--radius-md) 0 0 var(--radius-md); }
  .pc--b .grip { margin-left: 8px; margin-right: -4px; }
  .pc--b .grip + .pc__tile { border-radius: 0; }

  // c: a compact row: no label (the list's own name says it), the whole row opens Media
  .pc--c .pc__label { display: none; }
</style>
