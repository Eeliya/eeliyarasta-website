<!--
  A Text block's body in the panel (GroupFields.svelte): read only, dimmed. Each line with
  its style, its fields and counts as teal chips with their values (the item the block
  shows; a field it doesn't have: its name). It is edited in the preview only: Edit in
  preview (or a double click on it there) starts the edit in place (bridge.js, rich.js).
-->
<script>
  import { plural } from '../lib/format.js';
  import { countText, fieldText, styleLabel } from '../../site/text.js';
  import { sourceFile } from '../../site/files.js';

  // value: the body; item: the item the block shows (its fields), or null; live: the store;
  // onedit(): start editing it in the preview
  let { label = 'Text', value, item = null, items = 0, live, onedit } = $props();

  const lines = $derived(Array.isArray(value) ? value : []);
  const chip = (r) => {
    if (r.field !== undefined) return fieldText(r, item) || r.field;
    if (r.count?.source) {
      live.version;
      const list = live.get(sourceFile(r.count.source), '/items');
      return countText(Array.isArray(list) ? list.length : 0);
    }
    return countText(items);
  };
</script>

<div class="sum">
  <div class="sum__head">
    <span class="tf__label">{label}</span>
    <span class="sum__n">{plural(lines.length, 'line')}</span>
  </div>
  <div class="sum__box">
    {#each lines as line, i (i)}
      <p class="sum__p">
        <span class="sum__s">{styleLabel(line.style)}</span>
        <span class="sum__t"
          >{#each line.text || [] as r, k (k)}{#if typeof r.t === 'string'}<span
                class={[
                  r.marks?.includes('b') && 'is-b',
                  r.marks?.includes('i') && 'is-i',
                  r.link && 'is-a',
                ]}>{r.t}</span
              >{:else}<span class="sum__chip">{chip(r)}</span
              >{/if}{/each}{#if !line.text?.length}<span class="sum__empty">(empty)</span
            >{/if}</span
        >
      </p>
    {:else}
      <p class="sum__p"><span class="sum__empty">No text yet</span></p>
    {/each}
  </div>
  <button type="button" class="sum__edit" onclick={onedit}>
    <i class="fa-solid fa-pen" aria-hidden="true"></i><span>Edit in preview</span>
  </button>
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  .sum {
    @include stack(var(--space-2));
    grid-column: 1 / -1;
  }

  .sum__head {
    display: flex;
    justify-content: space-between;

    .tf__label {
      margin: 0;
    }
  }

  .sum__n {
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
  }

  // read only: the input's box, dimmed
  .sum__box {
    @include stack(var(--space-2));
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: var(--c-input);
    color: var(--c-text-muted);
    font-size: var(--fs-base);
    line-height: 20px;
    box-shadow: inset 0 0 0 1px var(--c-line);
  }

  .sum__p {
    display: grid;
    grid-template-columns: 80px minmax(0, 1fr);
    gap: var(--space-2);
    margin: 0;
  }

  .sum__s {
    color: var(--c-text-faint);
    font-size: var(--fs-2xs);
    letter-spacing: 0.08em;
    line-height: 20px;
    text-transform: uppercase;
  }

  .sum__t {
    overflow-wrap: anywhere;
    white-space: pre-line;
  }

  .is-b {
    font-weight: 700;
  }

  .is-i {
    font-style: italic;
  }

  .is-a {
    text-decoration: underline;
  }

  // a field or count: teal, whole
  .sum__chip {
    padding: 0 var(--space-1);
    border-radius: var(--radius-xs);
    background: color-mix(in srgb, var(--c-block-accent) 16%, transparent);
    color: var(--c-block-accent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c-block-accent) 45%, transparent);
  }

  .sum__empty {
    color: var(--c-text-faint);
  }

  .sum__edit {
    @include row(var(--space-2));
    justify-content: center;
    height: 32px;
    border: 0;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--c-block-accent) 18%, transparent);
    color: var(--c-block-accent);
    font: inherit;
    font-size: var(--fs-base);
    cursor: pointer;

    &:hover {
      background: color-mix(in srgb, var(--c-block-accent) 26%, transparent);
    }

    &:focus-visible {
      @include focus-ring;
    }
  }
</style>
