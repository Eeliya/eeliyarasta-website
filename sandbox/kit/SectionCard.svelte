<!--
  A page section's card as the Content tab draws it: the real SectionCard.svelte on the sample
  live state (title row: changed dot, title, eye, pen; count row: "N widgets ⌄", + Add widget,
  move up / down, Duplicate, Delete; its widgets inside when open, WidgetRow.svelte each).
    live      sampleLive() (one per mock)       at       its index in the sample page
    selected  the selected card (white 70% border; its buttons 100%)
    hover     drawn hovered (white 40% border; its buttons 100%)
    open      its widgets open inside the card   hoverRow that widget row drawn hovered (0, 1, …)
    changed   the changed dot before the title
    red       its delete confirm (the real one: over the card, red border)
  Buttons rest at 30% (a hidden section's or widget's eye-slash 100%), as built.
-->
<script>
  import RealCard from '../../src/editor/svelte/SectionCard.svelte';
  import { FILE } from './sample.js';

  let {
    live,
    at = 0,
    selected = false,
    hover = false,
    open = false,
    hoverRow = -1,
    changed = false,
    red = false,
  } = $props();
  const sections = $derived((live.version, live.store.current[FILE].sections));
  const last = $derived(at === sections.length - 1);
  // writable: the card's own Cancel / Delete clear it
  let deleting = $derived(red ? sections[at]?.id : '');

  // a widget row drawn hovered (its buttons 100%)
  const rowHover = (el) => {
    el.querySelectorAll('.brow')[hoverRow]?.classList.add('kit-hover');
  };
</script>

<div class={['kit-card', hover && 'kit-card--hover']} {@attach rowHover}>
  <RealCard
    {live}
    file={FILE}
    {at}
    {last}
    {selected}
    {changed}
    expanded={open}
    bind:deleting
    onselect={() => {}}
    onsection={() => {}}
    onopen={() => {}}
    onadd={() => {}}
  />
</div>

<style lang="scss">
  .kit-card {
    position: relative;
    display: flex;
    flex-direction: column;
  }

  // drawn hovered (editor.scss .sec:hover; SectionCard.svelte's buttons on hover)
  .kit-card--hover > :global(.sec:not(.is-selected, .is-danger)) {
    border-color: var(--c-line-hover);
  }

  .kit-card--hover :global(.sec > .sec__bar .btn),
  .kit-card--hover :global(.sec .line > *),
  .kit-card--hover :global(.sec .line .btn),
  .kit-card :global(.brow.kit-hover > .btn) {
    opacity: 1;
  }
</style>
