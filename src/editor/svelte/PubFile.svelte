<!--
  One file in a publish list (Browse, publish dialog): its git status letter (A new,
  M modified, D deleted), path, number of changes and +/- lines.
  f: a file of /__editor/status ({ path, status, changes, added, removed }).
  note: more text after the number of changes (optional).
-->
<script>
  import { plural } from '../lib/format.js';

  let { f, note = '' } = $props();
</script>

<li class="pfile">
  <span class={['pfile__st', `is-${f.status}`]}>
    {f.status === 'new' ? 'A' : f.status === 'deleted' ? 'D' : 'M'}
  </span>
  <code>{f.path}</code>
  <span class="muted">· {plural(f.changes || 1, 'change')}{note}</span>
  {#if f.added !== undefined}
    <span class="pfile__stat"
      ><span class="add">+{f.added}</span> <span class="del">−{f.removed}</span></span
    >
  {/if}
</li>
