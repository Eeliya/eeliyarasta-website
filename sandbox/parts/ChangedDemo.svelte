<!-- mock: where the "changed" marker sits. variant: now | A | B | C | D -->
<script>
  import Section from '../../src/editor/svelte/Section.svelte';
  import Field from '../../src/editor/svelte/Field.svelte';

  let { variant = 'now', caption = '' } = $props();
</script>

<div class="cd v-{variant}">
  <p class="cap">{caption}</p>
  <Section title="Hero" name="Eeliya Rasta" class="is-changed-sec">
    {#snippet bar()}
      {#if variant === 'now'}<i class="dot" title="Changed"></i>{/if}
      {#if variant === 'C'}<span class="pill">Edited</span>{/if}
      {#if variant === 'D'}<span class="count">2</span>{/if}
      <input type="checkbox" class="switch" checked aria-label="Show" />
    {/snippet}
    <div class="fields">
      <Field label="Title" value="Eeliya Rasta" changed />
      <Field label="Subtitle" value="Photographer, Amsterdam" />
      <Field label="Intro" type="block" value="I make photos of people and places." changed />
    </div>
  </Section>
</div>

<style>
  .cd { width: 360px; padding: 16px; display: flex; flex-direction: column; gap: 8px; }
  .cap { margin: 0; color: var(--c-text-muted); font-size: var(--fs-sm); line-height: 16px; }
  .fields { display: flex; flex-direction: column; gap: 12px; }

  /* A: 6px accent dot before the label */
  .v-A :global(.tf__label .dot) { order: -1; width: 6px; height: 6px; margin: 0; background: var(--c-accent); }
  .v-A :global(.is-changed-sec .sec__bar)::before {
    content: ''; flex: none; width: 6px; height: 6px; border-radius: 50%;
    background: var(--c-accent); margin: 7px 0;
  }

  /* B: accent bar on the left edge */
  .v-B :global(.tf .dot) { display: none !important; }
  .v-B :global(.tf.is-changed) { box-shadow: inset 2px 0 0 var(--c-accent); padding-left: 8px; }
  .v-B :global(.tf.is-changed .tf__label) { color: var(--c-text); }
  .v-B :global(.is-changed-sec) { box-shadow: inset 2px 0 0 var(--c-accent); }

  /* C: tinted label + Edited pill on the card */
  .v-C :global(.tf .dot) { display: none !important; }
  .v-C :global(.tf.is-changed .tf__label) { color: var(--c-accent); }
  .pill {
    height: 20px; padding: 0 8px; border-radius: 4px; font-size: 11px; line-height: 20px;
    letter-spacing: 0.04em; text-transform: none; color: var(--c-accent); background: var(--c-accent-bg);
  }

  /* D: dot at the label row's right end; the card shows a count */
  .v-D :global(.tf__label) { justify-content: space-between; }
  .v-D :global(.tf__label .dot) { margin: 0 4px 0 0; width: 6px; height: 6px; background: var(--c-accent); }
  .count {
    min-width: 20px; height: 20px; padding: 0 4px; border-radius: 10px; text-align: center;
    font-size: 11px; line-height: 20px; color: #000; background: var(--c-accent);
  }
</style>
