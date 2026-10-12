<!--
  A section setting's icon (16px). kind 'height': the screen (a frame) and the share of it the
  section is at least (filled, from the top; 'rows': custom, rows counted off; 0: fit, a bar
  hugged by two lines). kind 'width': the screen and a band across its middle, centred
  ('inside': contained) or edge to edge ('edge': full width).
-->
<script>
  let { kind, arg } = $props();
</script>

<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
  {#if kind === 'width'}
    <rect class="frame" x="2.5" y="1.5" width="11" height="13" rx="1.5" />
    {#if arg === 'edge'}
      <rect x="1" y="5.5" width="14" height="5" rx="0.5" />
    {:else}
      <rect x="5.5" y="5.5" width="5" height="5" rx="0.5" />
    {/if}
  {:else if arg === 'rows'}
    <rect class="frame" x="2.5" y="1.5" width="11" height="13" rx="1.5" />
    <rect x="4" y="3" width="8" height="5" rx="0.5" />
    <path class="frame" d="M4 10.5h8M4 12.5h8" />
  {:else if arg}
    <rect class="frame" x="2.5" y="1.5" width="11" height="13" rx="1.5" />
    <rect x="4" y="3" width="8" height={10 * arg} rx="0.5" />
  {:else}
    <rect x="4" y="6.5" width="8" height="3" rx="0.5" />
    <path class="frame" d="M2.5 4.5h11M2.5 11.5h11" />
  {/if}
</svg>

<style>
  svg {
    flex: none;
    fill: currentcolor;
  }

  .frame {
    fill: none;
    stroke: currentcolor;
    stroke-width: 1;
    opacity: 0.55;
  }
</style>
