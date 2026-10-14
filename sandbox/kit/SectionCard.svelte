<!--
  A page section's card as the Content tab draws it: the real Section, its real SectionSettings
  (on the sample live state), its blocks (BlockCard) and the dashed Add block.
    live    sampleLive() (one per mock)         at     its index in the sample page
    open    open or closed (default true)       red    the card's own border red (no size change)
    tools   snippet: replaces the bar's tools (Show, up, down, Duplicate, Delete, switch)
    over    snippet: drawn over the card, its exact box (a confirm, a scrim…); `.kit-over`
            covers the whole card, add `.kit-over--bar` for the header's height only
    children  replaces the body (SectionSettings)
    fields  false: no settings body (a part's section: just the header and blocks)
    rows    the tools on their own row under the title (the title wraps, full width)
    height  a fixed height for the card (e.g. '140px' while confirming), its content clipped
    changed the changed dot before the title
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
    open = true,
    red = false,
    fields = true,
    rows = false,
    height = '',
    changed = false,
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
    rows && 'kit-card--rows',
    height && 'kit-card--fixed',
  ]}
  style:--card-h={height || null}
>
  <Section id={s.id} {title} dim={!s.name?.trim()} {open} {changed}>
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
        <input
          type="checkbox"
          class="switch"
          aria-label="Show section {at + 1}"
          checked={s.enabled !== false}
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

  // the tools on their own row: the title takes the whole first row (and wraps); the tools
  // start under the title's text (the caret's 20px + 4px in), the switch at the right
  .kit-card--rows > :global(.sec > .sec__bar) {
    flex-wrap: wrap;
    row-gap: var(--space-2);
  }
  .kit-card--rows > :global(.sec > .sec__bar > .sec__toggle) {
    flex: 1 0 100%;
  }
  // with the changed dot first: the title takes the rest of the first row
  .kit-card--rows > :global(.sec.is-changed > .sec__bar > .sec__toggle) {
    flex-basis: calc(100% - var(--size-changed) - var(--space-1));
  }
  .kit-card--rows > :global(.sec > .sec__bar > .sec__toggle + *) {
    margin-left: 18px;
  }
  .kit-card--rows > :global(.sec > .sec__bar > :last-child) {
    margin-left: auto;
  }

  // a fixed height (a confirm): the card keeps it, its content clipped under the overlay
  .kit-card--fixed > :global(.sec) {
    height: var(--card-h);
    overflow: hidden;
  }
</style>
