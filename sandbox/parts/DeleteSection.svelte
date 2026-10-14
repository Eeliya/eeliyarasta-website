<!-- mock: a section's delete confirmation without a layout shift. v: now | a | b | c | d | e;
     closed: the card closed -->
<script>
  import Section from '../../src/editor/svelte/Section.svelte';
  import Button from '../../src/editor/svelte/Button.svelte';

  let { v = 'now', closed = false, caption = '' } = $props();
</script>

{#snippet tools(trash = true)}
  <Button size="small" icon="crosshairs" iconOnly label="Show in preview" />
  <Button size="small" icon="arrow-up" iconOnly label="Move up" />
  <Button size="small" icon="arrow-down" iconOnly label="Move down" disabled />
  <Button size="small" icon="copy" iconOnly label="Duplicate" />
  {#if trash}<Button size="small" icon="trash" iconOnly label="Delete section 6" />{/if}
{/snippet}

{#snippet body()}
  <input class="tf__input" placeholder="Name" aria-label="Name" />
  <p class="hint small anchor">Optional: a #link to this section</p>
  <div class="row"><span class="lbl">Height</span><span class="lbl">Width</span></div>
  <div class="row"><span class="seg"></span><span class="seg seg--2"></span></div>
{/snippet}

{#snippet foot()}
  <div class="blk"><i class="fa-solid fa-grip-vertical"></i><span>Project list</span></div>
  <div class="addblk"><i class="fa-solid fa-plus"></i>Add block</div>
{/snippet}

<div class="col">
  <p class="cap">{caption}</p>
  <div class="panel">
    <Section title="Section 5" open={false}>
      {#snippet bar()}{@render tools()}<input
          type="checkbox"
          class="switch"
          checked
          aria-label="Show"
        />{/snippet}
    </Section>

    {#if v === 'd'}
      <Section title="Section 7" open={false}>
        {#snippet bar()}{@render tools()}<input
            type="checkbox"
            class="switch"
            checked
            aria-label="Show"
          />{/snippet}
      </Section>
    {:else}
      <Section title="Section 6" open={!closed} class={v === 'c' ? 'del-c' : ''} {foot}>
        {#snippet bar()}
          {#if v === 'now'}
            {@render tools()}<input type="checkbox" class="switch" checked aria-label="Show" />
          {:else if v === 'a'}
            <!-- (a) the tools give way to a red Delete? and ✕, the same 24px row -->
            <span class="ask">
              <button type="button" class="pill pill--danger"
                ><i class="fa-solid fa-trash"></i>Delete?</button
              >
              <Button size="small" icon="xmark" iconOnly label="Cancel" />
            </span>
          {:else if v === 'b'}
            <!-- (b) a popover under the trash -->
            {@render tools(false)}
            <span class="anchor-trash">
              <span class="armed-icon"><i class="fa-solid fa-trash"></i></span>
              <span class="pop" role="dialog" aria-label="Delete section 6?">
                <span class="pop__msg">Delete Section 6 and its 1 block?</span>
                <span class="pop__row">
                  <button type="button" class="pill">Cancel</button>
                  <button type="button" class="pill pill--danger">Delete</button>
                </span>
              </span>
            </span>
            <input type="checkbox" class="switch" checked aria-label="Show" />
          {:else if v === 'c'}
            <!-- (c) the bar turns red: the question in the title's place, ✓ / ✕ -->
            <span class="cq">Delete Section 6?</span>
            <button type="button" class="ib ib--yes" aria-label="Delete"
              ><i class="fa-solid fa-check"></i></button
            >
            <button type="button" class="ib" aria-label="Cancel"
              ><i class="fa-solid fa-xmark"></i></button
            >
          {:else if v === 'e'}
            <!-- (e) arm: the trash turns solid red, a second click deletes; the hint in the switch's place -->
            {@render tools(false)}
            <span class="armed armed--on" title="Click again to delete"
              ><i class="fa-solid fa-trash"></i></span
            >
            <span class="again">Again</span>
          {/if}
        {/snippet}
        {@render body()}
      </Section>
    {/if}

    <div class="addsec"><i class="fa-solid fa-plus"></i>Add section</div>

    {#if v === 'd'}
      <div class="toast" role="status">
        <i class="fa-solid fa-trash"></i><span>Section 6 deleted</span>
        <button type="button" class="pill pill--accent">Undo</button>
        <Button size="small" icon="xmark" iconOnly label="Dismiss" />
      </div>
    {/if}
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
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 0 8px 8px;
    min-height: 560px;
    background: var(--c-surface);
  }

  .anchor {
    margin: 4px 0 12px;
    text-align: right;
  }
  .row {
    display: flex;
    gap: 12px;
    margin-bottom: 4px;
    > * {
      flex: 1;
    }
  }
  .lbl {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
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

  // small pills, 24px in the bar (the bar's own height), 32px in a popover / toast
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 24px;
    padding: 0 10px;
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
  .pill--accent {
    background: none;
    color: var(--c-accent);
    padding: 0 8px;
  }
  .ask {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  // (b)
  .anchor-trash {
    position: relative;
    display: flex;
  }
  .armed-icon {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 999px;
    background: var(--c-control);
    color: var(--c-error);
  }
  .pop {
    position: absolute;
    z-index: 5;
    top: 32px;
    right: -44px;
    width: 232px;
    display: grid;
    gap: 12px;
    padding: 12px;
    border-radius: var(--radius-md);
    background: var(--c-card);
    box-shadow:
      0 0 0 1px var(--c-line),
      0 8px 24px rgb(0 0 0 / 50%);
    text-transform: none;
    letter-spacing: 0;
    font-weight: 400;
    color: var(--c-text);
    &::before {
      content: '';
      position: absolute;
      top: -5px;
      right: 51px;
      width: 10px;
      height: 10px;
      rotate: 45deg;
      background: var(--c-card);
      box-shadow: -1px -1px 0 var(--c-line);
    }
    .pill {
      height: 32px;
      padding: 0 14px;
    }
  }
  .pop__msg {
    font-size: var(--fs-sm);
    line-height: 16px;
  }
  .pop__row {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  // (c) the bar solid red-tinted; a 4px spread so it reads as a band, no height change
  :global(.del-c > .sec__bar) {
    position: relative;
    background: #3a1a17 !important;
    margin-inline: 4px;
    padding-inline: 4px;
    border-radius: var(--radius-md);
    color: var(--c-error-strong) !important;
  }
  :global(.del-c > .sec__bar > .sec__toggle) {
    display: none;
  }
  .cq {
    flex: 1 !important;
    padding-left: 4px;
    line-height: 24px;
  }
  .ib {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border: 0;
    border-radius: 999px;
    background: none;
    color: var(--c-text);
    cursor: pointer;
  }
  .ib--yes {
    background: var(--c-danger);
    color: var(--c-on-danger);
  }

  // (e)
  .armed {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 999px;
  }
  .armed--on {
    background: var(--c-danger);
    color: var(--c-on-danger);
  }
  .again {
    width: 36px;
    line-height: 24px;
    color: var(--c-error);
    font-size: var(--fs-xs);
    text-align: center;
  }

  // (d) the panel's toast, over its foot: no shift
  .toast {
    position: absolute;
    left: 8px;
    right: 8px;
    bottom: 8px;
    display: flex;
    align-items: center;
    gap: 12px;
    height: 48px;
    padding: 0 8px 0 16px;
    border-radius: var(--radius-md);
    background: var(--c-card);
    box-shadow: 0 0 0 1px var(--c-line);
    color: var(--c-text);
    i {
      color: var(--c-text-muted);
    }
    span {
      flex: 1;
    }
    .pill {
      height: 32px;
    }
  }
</style>
