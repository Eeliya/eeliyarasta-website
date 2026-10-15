<!--
  A page section's card as the Content tab draws it: the real Section, its real SectionSettings
  (on the sample live state), its blocks (BlockCard) and the dashed Add block.
    live    sampleLive() (one per mock)         at     its index in the sample page
  As built: the real Section's onenter, always open (no caret), the title plain text in one
  colour (a default "Section N" too), the pen at the title row's right end (here it goes
  nowhere), hover a 40% white border, `selected` 70%; the visibility an eye in the tools.
    red     the card's own border red (no size change)
    selected  the selected card's border (white 70%)
    tools   snippet: replaces the bar's tools (Show, up, down, Duplicate, Delete, eye)
    over    snippet: drawn over the card, its exact box (a confirm, a scrim…); `.kit-over`
            covers the whole card, add `.kit-over--bar` for the header's height only
    children  replaces the body (SectionSettings)
    fields  false: no settings body (a part's section: just the header and blocks)
    rows    the tools on their own row under the title (the title wraps, full width): the
            real Section's `stack`, tools from the left edge
    height  a fixed height for the card (e.g. '140px' while confirming), its content clipped
    changed the changed dot before the title
    line    false: no line between the settings and the blocks (its space kept)
    spread  with rows: 'even' spreads the tools evenly across the card ('left' or '': as built)
-->
<script>
  import Section from '../../src/editor/svelte/Section.svelte';
  import SectionSettings from '../../src/editor/svelte/SectionSettings.svelte';
  import Button from '../../src/editor/svelte/Button.svelte';
  import BlockCard from './BlockCard.svelte';
  import { FILE } from './sample.js';
  import { LIST } from './styles.js';

  let {
    live,
    at = 0,
    red = false,
    selected = false,
    fields = true,
    rows = false,
    height = '',
    changed = false,
    line = true,
    spread = '',
    tools,
    over,
    children,
  } = $props();
  const sections = $derived((live.version, live.store.current[FILE].sections));
  const s = $derived(sections[at]);
  const title = $derived(s.name?.trim() || `Section ${at + 1}`);
</script>

<div
  class={[
    LIST,
    'kit-card',
    red && 'kit-card--red',
    height && 'kit-card--fixed',
    !line && 'kit-card--noline',
    !fields && !children && 'kit-card--nofields',
    rows && spread === 'even' && 'kit-card--even',
  ]}
  style:--card-h={height || null}
>
  <Section
    id={s.id}
    {title}
    off={s.enabled === false}
    {changed}
    {selected}
    stack={rows}
    onenter={() => {}}
    enterLabel="Edit section"
  >
    {#snippet bar()}
      {#if tools}{@render tools()}{:else}
        <Button size="small" icon="crosshairs" iconOnly label="Show in preview" />
        <Button size="small" icon="arrow-up" iconOnly label="Move up" disabled={at === 0} />
        <Button
          size="small"
          icon="arrow-down"
          iconOnly
          label="Move down"
          disabled={at === sections.length - 1}
        />
        <Button size="small" icon="copy" iconOnly label="Duplicate" />
        <Button size="small" icon="trash" iconOnly label="Delete section {at + 1}" />
        <Button
          size="small"
          icon={s.enabled === false ? 'eye-slash' : 'eye'}
          iconOnly
          label="Show section {at + 1}"
          aria-pressed={s.enabled !== false}
          data-eye
        />
      {/if}
    {/snippet}
    {#if children}{@render children()}{:else if fields}<SectionSettings
        {live}
        file={FILE}
        {at}
        {sections}
      />{/if}
    {#snippet foot()}
      <ul class="blocks">
        {#each s.blocks || [] as b (b.id)}<BlockCard block={b} />{/each}
      </ul>
      <button type="button" class="add add--block"
        ><i class="fa-solid fa-plus" aria-hidden="true"></i>Add block</button
      >
    {/snippet}
  </Section>
  {#if over}{@render over()}{/if}
</div>

<style lang="scss">
  .kit-card {
    position: relative;
    display: flex;
    flex-direction: column;
  }

  // .sec has a 1px transparent border: turning it red changes no size
  .kit-card--red > :global(.sec) {
    border-color: var(--c-danger);
  }

  // an overlay: the card's box inside its border (the card bleeds 8px each side)
  .kit-card > :global(.kit-over) {
    position: absolute;
    inset: 1px -7px;
    z-index: 2;
    border-radius: calc(var(--radius-lg) - 1px);
  }

  // the header's height only: the bar's 24px row in the card's 12px padding
  .kit-card > :global(.kit-over--bar) {
    bottom: auto;
    height: 46px;
  }

  // the title keeps its brightness on hover (not the app's white): its bar's colour, a default
  // title its faint one
  .kit-card > :global(.sec > .sec__bar > .sec__toggle.sec__toggle--enter:hover),
  .kit-card > :global(.sec > .sec__bar > .sec__toggle.sec__toggle--enter:hover > span) {
    color: inherit;
  }
  .kit-card > :global(.sec > .sec__bar > .sec__toggle.sec__toggle--enter:hover > .sec__title--dim) {
    color: var(--c-text-faint);
  }

  // a fixed height (a confirm): the card keeps it, its content clipped under the overlay
  .kit-card--fixed > :global(.sec) {
    height: var(--card-h);
    overflow: hidden;
  }

  // the tools row spread evenly
  .kit-card--even > :global(.sec > .sec__bar) {
    justify-content: space-between;
  }
  .kit-card--even > :global(.sec.sec--stack > .sec__bar > :last-child:not(.sec__toggle)) {
    margin-left: 0;
  }

  .kit-card--noline > :global(.sec .sec__foot) {
    border-top-color: transparent;
  }

  // no settings: no empty body above the blocks; they start 12px under the tools row
  .kit-card--nofields > :global(.sec .sec__inner) {
    display: none;
  }
  .kit-card--nofields > :global(.sec .sec__foot) {
    margin-top: 0;
  }
</style>
