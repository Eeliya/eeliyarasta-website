<!-- mock: the Source item card on the inputs' background. v: a | b | c (ItemPicker's card styles copied) -->
<script>
  import Button from '../../src/editor/svelte/Button.svelte';
  let { v = 'a', caption = '' } = $props();
</script>

<div class="col v-{v}">
  <p class="cap">{caption}</p>
  {#each [false, true] as filled (filled)}
    <div class="blk">
      <div class="opt">
        <span class="tf__label">Source item</span>
        <div class={['sc', !filled && 'is-empty']}>
          <button type="button" class="sc__main">
            {#if filled}
              <img class="sc__tile" src="/media/people/daan-okafor/01.jpg" alt="" />
            {:else}
              <span class="sc__tile"><i class="fa-solid fa-plus"></i></span>
            {/if}
            <span class="sc__text">
              <span class="sc__name">{filled ? 'Daan Okafor' : 'No item'}</span>
              <span class="sc__meta">{filled ? 'people · 12 photos' : 'Pick an item to fill fields from it'}</span>
            </span>
          </button>
          {#if filled}<Button size="small" icon="pen-to-square" iconOnly label="Edit" />{/if}
          <Button size="small" variant={filled ? 'primary' : 'default'}>{filled ? 'Change' : 'Choose'}</Button>
        </div>
      </div>
      {#each [['Name', filled ? 'Daan Okafor' : 'Eeliya Rasta'], ['Eyebrow', 'Portrait'], ['Subline', 'Amsterdam, 2026']] as [l, val] (l)}
        <label class="tf"><span class="tf__label">{l}</span><input class="tf__input" value={val} /></label>
      {/each}
    </div>
  {/each}
</div>

<style lang="scss">
  .col { width: 360px; display: flex; flex-direction: column; gap: 12px; }
  .cap { margin: 0; min-height: 32px; color: var(--c-text-muted); font-size: var(--fs-sm); line-height: 16px; }
  .blk { display: flex; flex-direction: column; gap: 12px; padding: 12px; border-radius: var(--radius-lg); background: var(--c-card); }
  .opt { min-width: 0; }
  .opt .tf__label { min-height: 24px; }

  // the card: [ tile | name / meta | edit | Change ]
  .sc {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2);
    border: 1px solid var(--c-line-strong);
    border-radius: var(--radius-lg);
    background: var(--c-card);
    cursor: pointer;

    &:hover {
      background: var(--c-card-peek);
    }

    &.is-empty {
      border-style: dashed;
      background: none;
    }
  }

  // the tile and the text: the keyboard's button
  .sc__main {
    display: flex;
    flex: 1;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;

    &:focus-visible {
      outline: none;
      box-shadow: 0 0 0 1px var(--c-accent);
    }
  }

  .sc__tile {
    display: grid;
    flex: none;
    place-items: center;
    width: 48px;
    height: 48px;
    border-radius: var(--radius-md);
    background: var(--c-switch);
    color: var(--c-accent);
    font-size: var(--fs-lg);
    object-fit: cover;

    .is-empty & {
      color: var(--c-text-faint);
    }
  }

  .sc__text {
    display: grid;
    gap: var(--space-1);
    min-width: 0;
  }

  .sc__name,
  .sc__meta {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sc__name {
    color: var(--c-text-strong);
    font-size: var(--fs-base);
    font-weight: 500;

    .is-empty & {
      color: var(--c-text-muted);
      font-weight: 400;
    }
  }

  .sc__meta {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);

    .is-empty & {
      white-space: normal;
    }
  }


  /* the variations: the inputs' background (--c-shadow) */
  .col:not(.v-current) .sc, .col:not(.v-current) .sc.is-empty { background: var(--c-shadow); }
  .v-a .sc, .v-a .sc.is-empty { border-color: transparent; }
  .v-b .sc, .v-b .sc.is-empty, .v-c .sc, .v-c .sc.is-empty {
    border: 0; border-radius: var(--radius-md); box-shadow: inset 0 0 0 1px var(--c-line);
  }
  .v-c span.sc__tile { background: var(--gray-1c); }
</style>
