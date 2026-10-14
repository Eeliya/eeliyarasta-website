<!-- mock: a section's delete confirmation over the card itself, its size kept.
     v: solid | red | scrim | compact; closed: the card closed -->
<script>
  import Section from '../../src/editor/svelte/Section.svelte';
  import Button from '../../src/editor/svelte/Button.svelte';

  let { v = 'solid', closed = false, caption = '' } = $props();
  // a closed card (or the compact one) asks in one row, the header's height
  const row = $derived(closed || v === 'compact');
</script>

{#snippet tools()}
  <Button size="small" icon="crosshairs" iconOnly label="Show in preview" />
  <Button size="small" icon="arrow-up" iconOnly label="Move up" />
  <Button size="small" icon="arrow-down" iconOnly label="Move down" disabled />
  <Button size="small" icon="copy" iconOnly label="Duplicate" />
  <Button size="small" icon="trash" iconOnly label="Delete section 6" />
  <input type="checkbox" class="switch" checked aria-label="Show" />
{/snippet}

{#snippet foot()}
  <div class="blk"><i class="fa-solid fa-grip-vertical"></i><span>Project list</span></div>
  <div class="blk"><i class="fa-solid fa-grip-vertical"></i><span>Photo grid</span></div>
  <div class="addblk"><i class="fa-solid fa-plus"></i>Add block</div>
{/snippet}

<div class="col">
  <p class="cap">{caption}</p>
  <div class="panel">
    <Section title="Section 5" open={false}>{#snippet bar()}{@render tools()}{/snippet}</Section>

    <div class="wrap">
      <Section title="Section 6" open={!closed} {foot}>
        {#snippet bar()}{@render tools()}{/snippet}
        <input class="tf__input" placeholder="Name" aria-label="Name" />
        <p class="hint small anchor">Optional: a #link to this section</p>
        <div class="row"><span class="seg"></span><span class="seg seg--2"></span></div>
      </Section>

      <div
        class={['ov', `ov--${v}`, row && 'ov--row']}
        role="alertdialog"
        aria-label="Delete Section 6 and its 2 blocks?"
      >
        {#if v === 'red' || v === 'compact' || (row && v !== 'scrim')}
          <span class="ov__icon"><i class="fa-solid fa-trash"></i></span>
        {/if}
        <p class="ov__msg">
          {#if row}Delete Section 6?{:else}Delete <b>Section 6</b> and its 2 blocks?{/if}
        </p>
        {#if !row}<p class="ov__sub">Undo brings it back.</p>{/if}
        <span class="ov__btns">
          <button type="button" class="pill">Cancel</button>
          <button type="button" class="pill pill--danger">Delete</button>
        </span>
      </div>
    </div>

    <div class="addsec"><i class="fa-solid fa-plus"></i>Add section</div>
  </div>
</div>

<style lang="scss">
  .col {
    width: 384px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .cap {
    margin: 0;
    min-height: 48px;
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    line-height: 16px;
  }
  .panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 0 8px 8px;
    min-height: 520px;
    background: var(--c-surface);
  }
  .anchor {
    margin: 4px 0 12px;
    text-align: right;
  }
  .row {
    display: flex;
    gap: 12px;
    > * {
      flex: 1;
    }
  }
  .seg {
    height: 32px;
    border-radius: var(--radius-md);
    background: var(--c-control);
    box-shadow: inset 0 0 0 1px var(--c-line);
  }
  .seg--2 {
    flex: 0.6;
  }
  .blk {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 40px;
    padding: 0 12px;
    margin-bottom: 8px;
    border-radius: var(--radius-md);
    background: var(--c-surface);
    color: var(--c-text);
    i {
      color: var(--c-text-faint);
    }
  }
  .addblk,
  .addsec {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 32px;
    border: 1px dashed var(--c-line);
    border-radius: var(--radius-lg);
    color: var(--c-text);
    font-size: var(--fs-base);
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .addsec {
    height: 40px;
    margin-inline: -8px;
  }

  // the card stays as it is; the overlay sits on it, the card's box (its -8px bleed)
  .wrap {
    position: relative;
  }
  .ov {
    position: absolute;
    inset: 0 -8px;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 16px;
    border-radius: var(--radius-lg);
    color: var(--c-text);
    text-align: center;
  }
  .ov__msg {
    margin: 0;
    font-size: var(--fs-base);
    line-height: 20px;
    b {
      color: var(--c-text-strong);
      font-weight: 600;
    }
  }
  .ov__sub {
    margin: 0;
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  .ov__btns {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }
  .ov__icon {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    flex: none;
    border-radius: 999px;
    background: var(--c-danger);
    color: var(--c-on-danger);
  }

  .pill {
    display: inline-flex;
    align-items: center;
    height: 32px;
    padding: 0 16px;
    border: 0;
    border-radius: 999px;
    background: var(--c-control);
    color: var(--c-text);
    font: inherit;
    font-size: var(--fs-sm);
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer;
  }
  .pill--danger {
    background: var(--c-danger);
    color: var(--c-on-danger);
  }

  // 1: solid, the menus' card tone, a 1px line
  .ov--solid {
    background: var(--c-card);
    box-shadow: inset 0 0 0 1px var(--c-line-strong, var(--c-line));
  }
  // 2: solid with a red edge and the trash
  .ov--red {
    background: var(--c-card);
    box-shadow: inset 0 0 0 1px var(--c-danger);
  }
  // 3: TRANSLUCENT (a scrim: against the no-translucent rule, shown to ask): the card shows through
  .ov--scrim {
    background: rgb(12 12 12 / 78%);
    box-shadow: inset 0 0 0 1px var(--c-line);
  }
  // 4: compact: only the header's height, over the bar (an open card's body stays visible)
  .ov--compact {
    bottom: auto;
    height: 48px;
    background: var(--c-card);
    box-shadow: inset 0 0 0 1px var(--c-danger);
  }

  // one row: icon | message | Cancel Delete (a closed card, the compact one)
  .ov--row {
    flex-direction: row;
    justify-content: flex-start;
    gap: 8px;
    padding: 0 8px;
    text-align: left;
    .ov__msg {
      flex: 1;
      font-weight: 500;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      font-size: var(--fs-sm);
    }
    .ov__btns {
      margin: 0;
    }
    .ov__icon {
      width: 24px;
      height: 24px;
      font-size: var(--fs-xs);
    }
    .pill {
      padding: 0 12px;
    }
  }
  .ov--scrim.ov--row {
    padding-left: 16px;
  }
</style>
