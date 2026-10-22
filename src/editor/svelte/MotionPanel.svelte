<!--
  Motion tab, two sub-tabs (ui.library.open: Animations):
  Elements    nothing picked: the page's widgets (its curtain is in Content > Transitions, the
              curtain itself in Settings), a box per
              section, each with its animation and its parts that have their own (data-anim
              inside it: the hero's photos, a heading's title, ...), then the animated elements
              outside the widgets (fixed parts).
              A widget picked (ui.anim.widget, from the preview or the list): its motion
              (WidgetMotion). A part or element picked: its animation (AnimEditor).
  Animations  the library (AnimLibrary): every animation, edit one with the preview in view.
  Picking in the preview goes to Elements; the widget picked is the Content tab's widget too.
-->
<script>
  import AnimEditor from './AnimEditor.svelte';
  import AnimLibrary from './AnimLibrary.svelte';
  import WidgetMotion from './WidgetMotion.svelte';
  import Button from './Button.svelte';
  import Tabs from './Tabs.svelte';
  import Section from './Section.svelte';
  import { ui } from './ui.svelte.js';
  import { nameOf } from './content-groups.js';
  import { targetFile } from '../layout-sync.js';
  import { WIDGET_TYPES } from '../../site/widgets/index.js';
  import { ANIMATIONS } from '../../site/files.js';
  import { animationOf, partOf } from './motion.js';

  // live: reactive store (live.svelte.js); bridge: the preview (../bridge.js);
  let { live, bridge } = $props();

  const TABS = [
    [false, 'Elements'],
    [true, 'Animations'],
  ];
  /** Open the Animations sub-tab, on animation `name` ('' = the list). */
  function openLibrary(name = '') {
    ui.library = { open: true, name };
  }

  // A new pick (preview click or the list) shows it: back to Elements.
  let picked = ui.anim;
  $effect(() => {
    if (ui.anim && ui.anim !== picked) ui.library.open = false;
    picked = ui.anim;
  });

  const cfg = $derived(live.current(ANIMATIONS));
  // The preview's GSAP and animated elements: re-read when it shows another page.
  const gsap = $derived.by(() => {
    ui.previewVersion;
    return bridge.api?.gsap;
  });
  const items = $derived.by(() => {
    ui.previewVersion;
    live.version;
    return bridge.api ? bridge.animElements() : [];
  });

  // The page's sections and widgets (its file), each widget with its element and parts.
  const file = $derived.by(() => {
    ui.previewVersion;
    return targetFile(ui.target, bridge.doc);
  });
  const sections = $derived.by(() => {
    ui.previewVersion;
    live.version;
    const list = file ? live.get(file, '/sections') : null;
    if (!Array.isArray(list) || !bridge.doc) return [];
    return list.map((s, at) => ({
      id: s.id,
      at,
      name: (s.widgets || []).map(nameOf).find(Boolean) || '',
      widgets: (s.widgets || []).map((b, j) => {
        const el = bridge.doc.querySelector(`[data-widget="${CSS.escape(b.id)}"]`);
        return {
          id: b.id,
          j,
          el,
          label: WIDGET_TYPES[b.type]?.label || b.type,
          name: nameOf(b),
          anim: b.motion?.anim || '',
          parts: el ? items.filter((it) => it.el.closest('[data-widget]') === el) : [],
        };
      }),
    }));
  });
  const outside = $derived(items.filter((it) => !it.el.closest('[data-widget]')));
  // the widget picked, where it is
  const picks = $derived.by(() => {
    const id = ui.anim?.widget;
    for (const s of sections) for (const b of s.widgets) if (b.id === id) return { s, b };
    return null;
  });

  /** Pick an element or widget (as a click in the preview does). */
  function pick(el) {
    if (!el) return;
    bridge.reveal(el);
    bridge.select(el, 'anim');
  }
</script>

{#snippet part({ el, id })}
  <li>
    <button
      type="button"
      class={['mlist__item', 'mlist__part', partOf(el, id) && 'is-changed']}
      title={partOf(el, id) ? 'Has its own values in this widget' : undefined}
      onclick={() => pick(el)}
      onpointerenter={() => bridge.setHover(el)}
      onpointerleave={() => bridge.setHover(null)}
    >
      <span class="mlist__id">
        {id}
      </span>
      <span class="muted">{animationOf(cfg, { id, el }) || '?'}</span>
    </button>
  </li>
{/snippet}

<section class="ed-body">
  {#if !gsap}
    <p class="hint">Waiting for the preview…</p>
  {:else}
    <Tabs
      class="mtabs"
      label="Motion"
      tabs={TABS}
      value={ui.library.open}
      onpick={(lib) => (ui.library.open = lib)}
    />
    {#if ui.library.open}
      <AnimLibrary {live} {bridge} {cfg} {items} {sections} {gsap} />
    {:else if picks}
      {#key ui.anim}
        <div class="msel__head">
          <Button size="small" icon="arrow-left" onclick={() => bridge.select(null)}
            >Elements</Button
          >
          <h3 class="msel__title">{picks.b.label}</h3>
          <span class="muted"
            >Section {picks.s.at + 1}{picks.b.name ? ` · ${picks.b.name}` : ''}</span
          >
        </div>
        <WidgetMotion
          {live}
          {bridge}
          {gsap}
          {cfg}
          {file}
          at={picks.s.at}
          j={picks.b.j}
          el={picks.b.el}
          onlibrary={openLibrary}
          onpart={pick}
        />
      {/key}
    {:else if ui.anim && !ui.anim.widget}
      {#key ui.anim}
        <AnimEditor
          {live}
          {bridge}
          {cfg}
          {items}
          {gsap}
          {file}
          {sections}
          onlibrary={openLibrary}
        />
      {/key}
    {:else}
      <p class="hint">
        Click a widget or an animated part of it in the preview, or pick one below. Hold Alt to
        click through to links.
      </p>
      {#each sections as s (s.id)}
        <Section key="motion:{s.id}" title="Section {s.at + 1}" name={s.name}>
          <ol class="list">
            {#each s.widgets as b (b.id)}
              <li>
                <button
                  type="button"
                  class="mlist__item"
                  data-widget-item={b.id}
                  disabled={!b.el}
                  onclick={() => pick(b.el)}
                  onpointerenter={() => bridge.setHover(b.el)}
                  onpointerleave={() => bridge.setHover(null)}
                >
                  <span class="mlist__id">{b.label}{b.name ? ` · ${b.name}` : ''}</span>
                  <span class="muted">{b.anim || 'none'}</span>
                </button>
                {#if b.parts.length}
                  <ol class="list mlist__parts">
                    {#each b.parts as p (p.el)}{@render part(p)}{/each}
                  </ol>
                {/if}
              </li>
            {/each}
          </ol>
        </Section>
      {/each}
      {#if outside.length}
        <Section key="motion:elements" title="Outside the widgets" name="Fixed parts">
          {#snippet bar()}<span class="mlist__count">{outside.length}</span>{/snippet}
          <ol class="list">
            {#each outside as it (it.el)}{@render part(it)}{/each}
          </ol>
        </Section>
      {/if}
    {/if}
  {/if}
</section>

<style lang="scss">
  @use '../styles/mixins' as *;

  // Elements | Animations, above everything else in the tab
  :global(.mtabs) {
    margin-bottom: var(--space-4);
  }

  .msel__head {
    @include stack(var(--space-1));
    margin-bottom: var(--space-3);
    justify-items: start;
  }

  .msel__title {
    margin: var(--space-2) 0 0;
    font-family: var(--f-display);
    font-weight: 400;
    font-size: var(--fs-3xl);
    line-height: 1;
  }

  // a widget's parts, under it
  .mlist__parts {
    margin: var(--space-1) 0 0 var(--space-4);
  }

  .mlist__part {
    font-size: var(--fs-sm);
  }

  .mlist__count {
    @include muted;
  }

  // motion panel
  .mlist__item {
    width: 100%;
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    line-height: 16px; // 32px tall
    border: 0;
    border-radius: var(--radius-lg);
    cursor: pointer;
    text-align: left;
    background: var(--c-fill-hover);
    box-shadow: inset 0 0 0 1px var(--c-line);

    &:hover {
      background: var(--c-fill-active);
    }
  }
</style>
