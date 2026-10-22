<!--
  A page section's settings (SectionsList.svelte's cards, and the widget view's top,
  WidgetInspector.svelte): its name (the whole row, its #anchor or what is wrong with it under
  it, right), then side by side its height (the phone's own in the phone preview, with its
  reset) and width as quiet icon buttons, and a custom height's rows. One undo step per change.
    live, file, at (its index), sections (the page's, a fresh copy after every edit)
-->
<script>
  import Field from './Field.svelte';
  import SectionIcon from './SectionIcon.svelte';
  import { ui } from './ui.svelte.js';
  import { setPhoneHeight, setSection, setSectionRows } from '../layout-ops.js';
  import {
    anchorOf,
    heightOf,
    mobileMinRowsOf,
    phoneHeightOf,
    nameProblems,
    rowsOf,
  } from '../../site/layout/index.js';

  let { live, file, at, sections } = $props();
  const s = $derived(sections[at] || {});

  // [value, label (its tooltip and aria-label), the share of the screen its icon fills]
  const HEIGHTS = [
    ['custom', 'Custom: a number of rows (space below the widgets)', 'rows'],
    ['fit', 'Fit content: as tall as its widgets', 0],
    ['third', 'At least 1/3 of the screen', 1 / 3],
    ['half', 'At least 1/2 of the screen', 1 / 2],
    ['full', 'At least the full screen', 1],
  ];
  // [value, label (its tooltip and aria-label), its icon's band: inside the frame or edge to edge]
  const WIDTHS = [
    ['contained', 'Contained: inside the page margins', 'inside'],
    ['full', 'Full width: edge to edge', 'edge'],
  ];
  const widthOf = (s) => (s.width === 'full' ? 'full' : 'contained');

  const changed = (at, key) => live.changed(file, `/sections/${at}/${key}`);
  const set = (at, patch, key) => setSection(live.store, file, at, patch, key);
  // Height and Width: one picked of a group (only a change is written: one undo step)
  const pick = (at, key, value, now) => {
    if (value === now) return;
    if (key === 'phoneHeight') return setPhoneHeight(live.store, file, at, value);
    if (key !== 'height') return set(at, { [key]: value });
    // custom: its rows to start from (its last ones, or its content's); others: none
    const s = sections[at];
    // (its own phone rows go when the phone isn't custom then: setSection)
    set(at, {
      height: value,
      rows: value === 'custom' ? { min: s.rows?.min || rowsOf(s) } : undefined,
    });
  };
  // the phone preview shows and edits a custom height's own phone rows (phone.rows.min)
  const phoneView = $derived(ui.viewport === 'mobile');
  const rowsShown = (s) =>
    ui.secRows?.id === s.id
      ? ui.secRows.rows
      : phoneView
        ? mobileMinRowsOf(s)
        : (s.rows?.min ?? rowsOf(s));
  // a custom height's rows, typed: one undo step per field edit
  const setMinRows = (at, v) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return;
    setSectionRows(live.store, file, at, v, {
      phone: phoneView,
      key: `section:${file}#${at}/${phoneView ? 'mobile/' : ''}rows/min`,
    });
  };
  // its name: empty removes it (no anchor)
  const setName = (at, name) =>
    set(at, { name: String(name ?? '').trim() ? name : undefined }, `section:${file}#${at}/name`);
  // what is wrong with each name (unique on the page, a letter first …), as the site checks it
  const problems = $derived(nameProblems(sections));
  const anchors = $derived(sections.map((s) => anchorOf(s.name)));
  const hintOf = (s, at) => {
    if (problems[at]) return `⚠ ${problems[at]}`;
    const a = anchors[at];
    // the first of two alike (the site flags the later one): flagged here too
    const twin = a ? anchors.findIndex((b, i) => i !== at && b === a) : -1;
    if (twin >= 0) return `⚠ #${a} is also section ${twin + 1}'s anchor`;
    return a ? `#${a}` : 'Optional: a #link to this section';
  };
</script>

<!-- a height's icon: the screen (a frame) and the share of it the section is at least (filled,
     from the top); fit: a bar hugged by two lines (as tall as its content) -->
<!-- a width's icon: the screen (a frame) and a band across its middle, narrower and centred
     (contained: inside the page margins) or from edge to edge (full width) -->
{#snippet widthIcon(band)}
  <SectionIcon kind="width" arg={band} />
{/snippet}

<!-- a setting as a half field (.tf: the same label row as a Field) of quiet icon buttons, one
     picked: Height and Width. options: [value, label, its icon's argument] -->
{#snippet choices(at, key, title, options, now, icon, reset = null)}
  {@const id = `${sections[at].id}-${key}`}
  {@const ptr = key === 'phoneHeight' ? 'mobile/height' : key}
  <div
    class={['tf', 'is-half', changed(at, ptr) && 'is-changed']}
    data-edit="{file}#/sections/{at}/{ptr}"
  >
    <span class="tf__label" {id}
      >{title}
      {#if reset}
        <!-- its own phone height: back to the desktop's -->
        <button
          type="button"
          class="hreset"
          title="Reset phone height (follow the desktop)"
          aria-label="Reset phone height"
          disabled={!reset.on}
          onclick={reset.run}><i class="fa-solid fa-rotate-left" aria-hidden="true"></i></button
        >
      {/if}</span
    >
    <div class="hset" role="radiogroup" aria-labelledby={id}>
      {#each options as [value, label, arg] (value)}
        <button
          type="button"
          role="radio"
          aria-checked={now === value}
          aria-label={label}
          title={label}
          class={['hset__btn', now === value && 'is-active']}
          onclick={() => pick(at, key, value, now)}
        >
          {@render icon(arg)}
        </button>
      {/each}
    </div>
  </div>
{/snippet}

{#snippet heightIcon(share)}
  <SectionIcon kind="height" arg={share} />
{/snippet}

<!-- Name (no label: its placeholder says it; its #anchor under it) the whole row; then Height | Width, two halves -->
<div class="fields">
  <Field
    edit="{file}#/sections/{at}/name"
    label="Name"
    bare
    placeholder="Name"
    value={s.name ?? ''}
    help={hintOf(s, at)}
    changed={changed(at, 'name')}
    onvalue={(name) => setName(at, name)}
  />
  <!-- Height (a minimum; its content always centred) | Width: icon buttons, one picked -->
  {#if phoneView}
    <!-- the phone preview: its phone height (its own, else the desktop's) -->
    {@render choices(
      at,
      'phoneHeight',
      s.phone?.height ? 'Phone height' : 'Phone height (desktop)',
      HEIGHTS,
      phoneHeightOf(s),
      heightIcon,
      {
        on: !!s.phone?.height,
        run: () => setPhoneHeight(live.store, file, at, undefined),
      },
    )}
  {:else}
    {@render choices(at, 'height', 'Height', HEIGHTS, heightOf(s), heightIcon)}
  {/if}
  {@render choices(at, 'width', 'Width', WIDTHS, widthOf(s), widthIcon)}
  {#if (phoneView ? phoneHeightOf(s) : heightOf(s)) === 'custom'}
    <!-- custom: its rows (square cells, from the top; those below its last widget are empty
         space; on phones half as many) -->
    <Field
      edit="{file}#/sections/{at}/{phoneView ? 'mobile/' : ''}rows/min"
      label={phoneView ? 'Phone rows' : 'Rows'}
      type="number"
      half
      value={rowsShown(s)}
      help={phoneView
        ? 'Phone only; unset: half the desktop rows'
        : 'Rows below the last widget are space (phones: their own, or half)'}
      changed={changed(at, phoneView ? 'mobile/rows/min' : 'rows/min')}
      onvalue={(v) => setMinRows(at, v)}
    />
  {/if}
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  // the settings, then the widgets
  // the name's #anchor hint at its right, under it
  .fields > :global(:first-child .tf__help) {
    text-align: right;
  }

  // a utility group: icon-only, no fill; the picked one in the accent, on a faint ground
  // 32px tall, like the inputs (4 + 24 + 4), its buttons sharing the half's width
  .hset {
    display: flex;
    gap: var(--space-1);
    height: var(--size-control);
    padding: var(--space-1);
    border-radius: var(--radius-md);
    box-shadow: inset 0 0 0 1px var(--c-line);
    justify-self: start;
  }

  // the phone height's reset: a quiet icon in its label row
  .hreset {
    display: inline-grid;
    place-items: center;
    width: 16px;
    height: 16px;
    margin-left: var(--space-1);
    padding: 0;
    border: 0;
    background: none;
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    cursor: pointer;

    &:hover:not(:disabled) {
      color: var(--c-text);
    }

    &:disabled {
      opacity: var(--o-disabled);
      cursor: default;
    }

    &:focus-visible {
      @include focus-ring;
    }
  }

  .hset__btn {
    display: grid;
    flex: 1;
    place-items: center;
    height: 24px;
    width: 36px;
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--c-text-muted);
    cursor: pointer;
    transition:
      color 0.2s,
      background 0.2s;

    &:hover {
      color: var(--c-text);
    }

    &.is-active {
      background: var(--c-fill-active);
      color: var(--c-accent);
    }

    &:focus-visible {
      @include focus-ring;
    }
  }
</style>
