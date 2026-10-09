<!--
  Content tab: every editable text of the page in the preview (or of the Menu / Footer),
  grouped by section (content-groups.js decides which texts and groups). Home sections can
  be turned on/off and moved; grid sections pick their source list and layout. The Sources
  section at the end opens the Sources modal.

  Selection goes both ways through ui.selection: main.js sets it when a text is clicked in
  the preview, a field sets it (via the bridge) when it gets focus. This panel highlights
  that field and scrolls to it.
-->
<script module>
  // Open/closed per group id, once the user toggled it. Kept while switching tabs.
  const opened = $state({});
  // Groups that start open; home sections ("s0", "s1", ...) do too.
  const OPEN = ['hero', 'transition', 'nav', 'footer', 'page-head', 'about', 'content', 'sources'];
  const isOpen = (id) => opened[id] ?? (OPEN.includes(id) || /^s\d+$/.test(id));
</script>

<script>
  import { tick } from 'svelte';
  import Field from './Field.svelte';
  import SourcesModal from './SourcesModal.svelte';
  import { ui } from './ui.svelte.js';
  import {
    contentGroups,
    groupFor,
    homeSections,
    isSource,
    previewPage,
    splitEdit,
  } from './content-groups.js';
  import { parse } from '../lib/pointer.js';
  import { plural } from '../lib/format.js';
  import { HOME, baseName } from '../../site/files.js';

  // live: reactive store (live.svelte.js); bridge: the preview (../bridge.js)
  let { live, bridge } = $props();

  let panel = $state();
  let sourcesModal = $state();

  // The texts come from the preview's [data-edit] elements: re-read them after every edit
  // (sections may have moved) and when the preview shows another page.
  const groups = $derived.by(() => {
    live.version;
    ui.previewVersion;
    return contentGroups(live.store, bridge, ui.target);
  });
  const waiting = $derived.by(() => {
    ui.previewVersion;
    return ui.target.kind === 'page' && !bridge.api;
  });
  // The lists in content/sources/, shown under the page's own groups.
  const sources = $derived.by(() => {
    live.version;
    return ui.target.kind === 'page' ? Object.keys(live.store.current).filter(isSource).sort() : [];
  });
  const hint = $derived(
    ui.target.kind === 'page'
      ? 'Click any outlined text in the preview to edit it in place, or use the fields below. Turn a section Off to hide it on the public page.'
      : ui.target.id === 'menu'
        ? 'Editing Menu labels. Changes show in the header and mobile menu of the preview.'
        : 'Editing Footer copy. Scroll the preview to the bottom to see changes.',
  );

  const isOn = (g) => !g.toggle || live.get(g.toggle.file, g.toggle.ptr) !== false;
  // A missing flag counts as on.
  const toggleChanged = (g) =>
    (live.get(g.toggle.file, g.toggle.ptr) ?? true) !==
    (live.getBase(g.toggle.file, g.toggle.ptr) ?? true);

  function setOn(g, on) {
    live.store.set(g.toggle.file, g.toggle.ptr, on, { key: `section:${g.id}`, source: 'panel' });
  }

  /** Swap home section `g` with its neighbour (dir -1 = up, 1 = down): one undo step. */
  async function move(g, dir) {
    const i = g.index;
    const j = i + dir;
    const list = [...homeSections(live.store)];
    [list[i], list[j]] = [list[j], list[i]];
    // Open/closed follows the section, not the position.
    [opened[`s${i}`], opened[`s${j}`]] = [isOpen(`s${j}`), isOpen(`s${i}`)];
    live.store.set(HOME, '/sections', list, { source: 'panel' });
    // Keep the focus on the moved section's button (or its title at the top / bottom).
    await tick();
    const moved = panel.querySelector(`[data-section="s${j}"]`);
    const button = moved.querySelector(`[data-dir="${dir < 0 ? 'up' : 'down'}"]`);
    (button.disabled ? moved.querySelector('summary') : button).focus();
  }

  function setConfig(g, key, value) {
    live.store.set(HOME, `/sections/${g.index}/config/${key}`, value, { source: 'panel' });
  }

  function setText(f, value) {
    live.store.set(f.file, f.ptr, value, { key: `text:${f.edit}`, source: 'panel' });
  }

  /** Open the group holding `edit` and scroll to it; list items open the Sources modal. */
  async function reveal(edit) {
    await tick(); // not inside the effect below: the modal renders synchronously when opened
    const group = groups.find((g) => g.fields.some((f) => f.edit === edit));
    if (!group) {
      const { file, ptr } = splitEdit(edit);
      // A list item shown on the home page (a person's name): edit it in the modal.
      if (groupFor(live.store, { file, ptr }, previewPage(bridge)).id.startsWith('source:'))
        sourcesModal.open(file, Number(parse(ptr)[0]) || 0, edit);
      return;
    }
    opened[group.id] = true;
    await tick();
    panel
      .querySelector(`[data-edit="${CSS.escape(edit)}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  $effect(() => {
    const edit = ui.selection?.edit;
    if (edit) reveal(edit);
  });
</script>

{#snippet editButton(file, compact = false)}
  <button
    type="button"
    class={['btn-sm', compact && 'btn-sm--compact']}
    title="Edit {baseName(file)}"
    aria-label="Edit {baseName(file)}"
    onclick={() => sourcesModal.open(file)}
  >
    <i class="fa-solid fa-pen-to-square" aria-hidden="true"></i>{compact ? '' : ' Edit'}
  </button>
{/snippet}

<!-- a grid setting: label (title + select), the Source one with an edit button beside it -->
{#snippet option(g, key, title, value, options)}
  {@const edit = key === 'source' && !g.grid.missing}
  <div
    class={[
      'sec__opt',
      live.changed(HOME, `/sections/${g.index}/config/${key}`) && 'is-changed',
      edit && 'has-extra',
    ]}
  >
    <label class="sec__opt-field">
      <span class="tf__label">{title}<i class="dot" title="Changed"></i></span>
      <select class="f__select" {value} onchange={(e) => setConfig(g, key, e.currentTarget.value)}>
        {#each options as [v, text] (v)}
          <option value={v}>{text}</option>
        {/each}
      </select>
    </label>
    {#if edit}{@render editButton(`sources/${value}.json`, true)}{/if}
  </div>
{/snippet}

<section class="ed-body" bind:this={panel}>
  {#if waiting}
    <p class="hint">Waiting for the preview…</p>
  {:else}
    <p class="hint">{hint}</p>
    {#each groups as g (g.id)}
      <details
        class={['sec', !isOn(g) && 'is-off']}
        data-section={g.id}
        open={isOpen(g.id)}
        ontoggle={(e) => (opened[g.id] = e.currentTarget.open)}
      >
        <summary class="sec__bar">
          <i class="fa-solid fa-chevron-right sec__caret" aria-hidden="true"></i>
          {g.title}
          {#if !g.toggle}<span class="sec__count">{g.fields.length}</span>{/if}
          {#if g.index !== undefined}
            {@const last = homeSections(live.store).length - 1}
            <button
              type="button"
              class="sec__move"
              data-dir="up"
              title="Move up"
              aria-label="Move up: {g.title}"
              disabled={g.index === 0}
              onclick={() => move(g, -1)}
            >
              <i class="fa-solid fa-arrow-up" aria-hidden="true"></i>
            </button>
            <button
              type="button"
              class="sec__move"
              data-dir="down"
              title="Move down"
              aria-label="Move down: {g.title}"
              disabled={g.index === last}
              onclick={() => move(g, 1)}
            >
              <i class="fa-solid fa-arrow-down" aria-hidden="true"></i>
            </button>
          {/if}
          {#if g.toggle}
            {#if toggleChanged(g)}<i class="dot" title="Changed"></i>{/if}
            <!-- on/off switch: a checkbox drawn by CSS (.sec__check) -->
            <input
              type="checkbox"
              class="sec__check"
              aria-label="Show {g.title}"
              title={isOn(g) ? 'Section is visible' : 'Section is hidden on the public page'}
              checked={isOn(g)}
              onchange={(e) => setOn(g, e.currentTarget.checked)}
            />
          {/if}
        </summary>

        {#if g.grid}
          <div class="sec__opts">
            {@render option(
              g,
              'source',
              'Source',
              g.grid.source,
              g.grid.sources.map((id) => [
                id,
                `${id}.json${id === g.grid.source && g.grid.missing ? ' (missing)' : ''}`,
              ]),
            )}
            {@render option(g, 'layout', 'Layout', g.grid.layout, [
              ['staggered', 'Staggered'],
              ['even', 'Even'],
            ])}
            {#if ui.staleSections.includes(g.index)}
              <p class="hint small sec__note">The preview shows this grid after Save.</p>
            {/if}
          </div>
        {/if}

        {#each g.fields as f (f.edit)}
          <Field
            {...f}
            value={live.get(f.file, f.ptr)}
            changed={live.changed(f.file, f.ptr)}
            selected={ui.selection?.edit === f.edit}
            onfocus={() => bridge.focusEdit(f.edit)}
            onvalue={(value) => setText(f, value)}
          />
        {:else}
          {#if !g.grid}
            <p class="hint small">
              {isOn(g)
                ? 'No text fields in this section.'
                : 'Section is off. Turn it on to show it on the page.'}
            </p>
          {/if}
        {/each}
      </details>
    {:else}
      <p class="hint">No editable content here.</p>
    {/each}

    {#if sources.length}
      <details
        class="sec"
        data-section="sources"
        open={isOpen('sources')}
        ontoggle={(e) => (opened.sources = e.currentTarget.open)}
      >
        <summary class="sec__bar">
          <i class="fa-solid fa-chevron-right sec__caret" aria-hidden="true"></i>
          Sources
          <span class="sec__count">{sources.length}</span>
        </summary>
        <ul class="src-rows">
          {#each sources as file (file)}
            {@const list = live.current(file)}
            <li class={['src-row', live.changed(file, '') && 'is-changed']}>
              {baseName(file)}<i class="dot" title="Changed"></i>
              <span class="src-row__count">
                {Array.isArray(list) ? plural(list.length, 'item') : 'not a list'}
              </span>
              {#if Array.isArray(list)}{@render editButton(file)}{/if}
            </li>
          {/each}
        </ul>
      </details>
    {/if}
  {/if}

  <SourcesModal bind:this={sourcesModal} {live} {bridge} />
</section>

<style lang="scss">
  // content section groups: <details class="sec"> with the bar as its <summary>
  .sec {
    padding: 10px 0;
    border-top: 1px solid var(--line);

    > summary + :global(*) {
      margin-top: 8px;
    }

    > :global(:not(summary)) {
      margin-left: 2px;
    }

    > :global(:not(summary)) + :global(:not(summary)) {
      margin-top: 12px;
    }
  }

  // caret, title, then on the right: field count, move buttons and/or the on/off toggle
  .sec__bar {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 26px;
    cursor: pointer;
    list-style: none;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--faint);

    &::-webkit-details-marker {
      display: none;
    }

    &:hover {
      color: #fff;
    }

    .sec__caret + * {
      margin-left: auto;
    }
  }

  // (size and display come from Font Awesome's .fa-solid)
  .sec__caret {
    color: var(--muted);
    flex: none;
    font-size: 10px;
    transition: rotate 0.15s;

    .sec[open] & {
      rotate: 90deg;
    }
  }

  .sec__count {
    color: var(--faint);
    font-size: 10px;
    letter-spacing: 0;
  }

  // on/off switch: a checkbox drawn as a track, its knob a radial gradient that slides right
  // when checked. Off: dark track, grey knob. On: whitish track, black knob.
  .sec__check {
    flex: none;
    appearance: none;
    margin: 0;
    width: 28px;
    height: 16px;
    border-radius: 999px;
    cursor: pointer;
    background: radial-gradient(circle, var(--muted) 5.5px, transparent 6.5px) 0 0 / 16px 16px
      no-repeat #262625;
    box-shadow: inset 0 0 0 1px #3a3a38;
    transition:
      background-position 0.2s,
      background-color 0.2s;

    &:checked {
      background-image: radial-gradient(circle, #030303 5.5px, transparent 6.5px);
      background-position: 12px 0;
      background-color: var(--fg);
      box-shadow: none;
    }

    &:focus-visible {
      outline: none;
      box-shadow:
        0 0 0 2px #030303,
        0 0 0 3px var(--fg);
    }
  }

  .sec.is-off {
    > summary {
      color: var(--muted);
    }

    > :global(:not(summary)) {
      opacity: 0.55;
    }
  }

  // home section order (click only) and grid settings
  .sec__move {
    width: 22px;
    height: 22px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 6px;
    background: none;
    color: var(--muted);
    font-size: 10px;
    cursor: pointer;

    &:hover:not(:disabled) {
      color: var(--fg);
      background: rgb(255 255 255 / 0.06);
    }

    &:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 1px var(--hi);
    }

    &:disabled {
      color: var(--faint);
      cursor: default;
    }

    // up and down sit 2px apart
    & + & {
      margin-left: -6px;
    }
  }

  .sec__opts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .sec__opt {
    position: relative;
    min-width: 0;
    padding: 2px;

    // the edit button sits beside the label, drawn at the right of the title row
    > .btn-sm {
      position: absolute;
      top: 2px;
      right: 2px;
      height: 22px;
      margin: 0;
    }

    &.has-extra .tf__label {
      padding-right: 28px;
    }

    .dot {
      display: none;
    }

    &.is-changed .dot {
      display: inline-block;
    }
  }

  .sec__note {
    grid-column: 1 / -1;
    margin: 0;
  }

  .sec__opt-field {
    display: block;
  }

  // sources: list in the Content panel + edit modal
  .sec__opt .tf__label {
    min-height: 22px;
  }

  .src-rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 12px;
  }

  // file name, changed dot, item count, edit button
  .src-row {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--fg);

    .dot {
      display: none;
      margin-left: 0;
    }

    &.is-changed .dot {
      display: inline-block;
    }
  }

  .src-row__count {
    margin-left: auto;
    color: var(--muted);
    font-size: 10.5px;
  }
</style>
