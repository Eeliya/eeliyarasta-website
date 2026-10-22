<!--
  The page's sections in the Content tab (src/site/layout/): a card each (SectionCard.svelte:
  its title, eye and pen; its widgets count, which opens its widgets inside the card, Add widget,
  move up / down, Duplicate, Delete), then the dashed Add section card, which adds an empty
  section after the last one. A click on a card selects it (ui.selSection: its section shown in
  the preview, overlay.js); a double click or its pen opens its settings (onsection); a widget's
  row opens its settings (onopen), as a click on the widget in the preview does. Widgets have no
  order here: they are placed in the preview. Every change is one undo step (layout-ops.js).
-->
<script>
  import { tick } from 'svelte';
  import SectionCard from './SectionCard.svelte';
  import { ui } from './ui.svelte.js';
  import { addSection } from '../layout-ops.js';

  let { live, file, onopen, onsection, onadd } = $props();
  let deleting = $state(''); // the id of the section asking "Delete?"

  const sections = $derived.by(() => {
    const list = live.current(file)?.sections;
    return Array.isArray(list) ? list : [];
  });

  // Add section: an empty section after the last one, scrolled into view
  async function add() {
    deleting = '';
    addSection(live.store, file);
    await tick();
    const s = sections.at(-1);
    if (!s) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    document
      .querySelector(`[data-section="${CSS.escape(s.id)}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }

  // hover sync: a section card the pointer is over shows its section in the preview
  // (overlay.js); one hovered in the preview shows its card here (.is-peek)
  $effect(() => {
    const over = (e) => {
      const id = e.target.closest?.('[data-section^="s-"]')?.dataset.section || '';
      if (id) {
        if (ui.peek?.id !== id || ui.peek.from !== 'panel') ui.peek = { id, from: 'panel' };
      } else if (ui.peek?.from === 'panel') ui.peek = null;
    };
    const out = () => ui.peek?.from === 'panel' && (ui.peek = null);
    document.addEventListener('pointerover', over);
    document.documentElement.addEventListener('pointerleave', out);
    return () => {
      document.removeEventListener('pointerover', over);
      document.documentElement.removeEventListener('pointerleave', out);
      out();
    };
  });
</script>

{#each sections as s, at (s.id)}
  <SectionCard
    {live}
    {file}
    {at}
    last={at === sections.length - 1}
    peek={ui.peek?.from === 'preview' && ui.peek.id === s.id}
    selected={ui.selSection === s.id}
    bind:deleting
    onselect={() => (ui.selSection = s.id)}
    onsection={() => onsection(s.id)}
    {onopen}
    {onadd}
  />
{/each}

<button type="button" class="add" onclick={add}>
  <i class="fa-solid fa-plus" aria-hidden="true"></i>Add section
</button>

<style lang="scss">
  @use '../styles/mixins' as *;

  // Add section: a dashed card the section cards' width, + and its name centred
  .add {
    @include row(var(--space-2));
    flex: none;
    justify-content: center;
    width: 100%;
    height: 40px;
    border: 1px dashed var(--c-line);
    border-radius: var(--radius-lg);
    background: none;
    color: var(--c-text);
    font: inherit;
    font-size: var(--fs-base);
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;

    &:hover,
    &:focus-visible {
      border-color: var(--c-accent);
      color: var(--c-text-strong);
      outline: none;
    }
  }
</style>
