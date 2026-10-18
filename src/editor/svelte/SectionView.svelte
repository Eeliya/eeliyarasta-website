<!--
  A section's settings (ui.section; its card's pen or a double click on it, SectionsList.svelte),
  one level under the list: its top (ViewTop.svelte: ← Back, Locate), then its settings card on
  the settings fill, titled with its name ("Section N" without one): SectionSettings.svelte.
  No blocks here: they are on its card in the list and in the preview.
    live, bridge, file, id (the section's), onback
-->
<script>
  import SectionSettings from './SectionSettings.svelte';
  import ViewTop from './ViewTop.svelte';

  let { live, bridge, file, id, onback } = $props();

  // a fresh copy after every edit (SectionSettings reads the values from it); found by its id:
  // it keeps its view while sections move above it
  const sections = $derived.by(() => {
    live.version;
    const list = live.current(file)?.sections;
    return Array.isArray(list) ? list : [];
  });
  const at = $derived(sections.findIndex((s) => s?.id === id));
  const title = $derived.by(() => {
    const n = sections[at]?.name;
    return (typeof n === 'string' && n.trim()) || `Section ${at + 1}`;
  });
</script>

{#if at >= 0}
  <ViewTop {bridge} {id} {onback} />
  <div class="card">
    <h2 class="card__title">{title}</h2>
    <SectionSettings {live} {file} {at} {sections} />
  </div>
{/if}

<style lang="scss">
  @use '../styles/mixins' as *;

  // on the settings fill, as wide as the list's cards (their -8px bleed), 12px inside; its 1px
  // border kept, transparent (the content where a framed card has it)
  .card {
    @include stack(var(--space-3));
    margin-inline: -8px;
    padding: var(--space-3);
    border: 1px solid transparent;
    border-radius: var(--radius-lg);
    background: var(--c-settings);
  }

  .card__title {
    @include ellipsis;
    margin: 0;
    color: var(--c-text);
    font-size: var(--fs-base);
    font-weight: 500;
    line-height: 20px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
</style>
