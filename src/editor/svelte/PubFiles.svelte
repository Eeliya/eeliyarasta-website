<!--
  A list of content files to publish (Browse "Saved, not published" and the publish dialog):
  per file its git status letter (A new, M modified, D deleted), path, number of changes,
  an optional note and the +/- lines.
  files: [{ path, status, changes, added, removed, note }] as /__editor/status gives them
  (note, added and removed are optional).
-->
<script>
  import { plural } from '../lib/format.js';

  let { files } = $props();

  const LETTERS = { new: 'A', deleted: 'D' };
</script>

<ul class="list files">
  {#each files as f (f.path)}
    <li class="pfile">
      <span class={['pfile__st', `is-${f.status}`]}>{LETTERS[f.status] || 'M'}</span>
      <code>{f.path}</code>
      <span class="muted">· {plural(f.changes || 1, 'change')}{f.note}</span>
      {#if f.added !== undefined}
        <span class="pfile__stat"
          ><span class="add">+{f.added}</span> <span class="del">−{f.removed}</span></span
        >
      {/if}
    </li>
  {/each}
</ul>

<style lang="scss">
  .files {
    margin-bottom: 14px;
  }

  // publish dialog
  .pfile {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0 6px;

    code {
      color: var(--fg);
    }
  }

  .pfile__st {
    width: 16px;
    flex: none;
    font-weight: 500;
    color: #ffcf7a;

    &.is-new {
      color: #b9f0c4;
    }

    &.is-deleted {
      color: #ff8a7a;
    }
  }

  .pfile__stat {
    margin-left: auto;
    font-size: 11px;

    .add {
      color: #b9f0c4;
    }

    .del {
      color: #ff8a7a;
    }
  }
</style>
