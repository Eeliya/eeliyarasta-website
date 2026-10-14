<!--
  One labelled cell of a Compare: its label (accent) and an optional line, then the mock.
    label   "A", "2 header blur", …    note   optional: what it is, one or two lines
-->
<script>
  let { label = '', note = '', children } = $props();
</script>

<div class="kit-variant">
  <p class="kit-variant__label">{label}</p>
  <p class="kit-variant__note">{note}</p>
  <div class="kit-variant__body">{@render children?.()}</div>
</div>

<style lang="scss">
  .kit-variant {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }

  .kit-variant__label {
    margin: 0;
    color: var(--c-accent);
    font-size: var(--fs-base);
    font-weight: 600;
  }

  .kit-variant__note {
    min-height: 32px;
    margin: 0 0 var(--space-2);
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    line-height: 16px;
  }

  .kit-variant__body {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: 0 var(--space-2);
  }
</style>
