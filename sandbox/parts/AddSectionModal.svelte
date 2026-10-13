<!-- mock: Add section opens a modal to pick what the new section starts with.
     look: tiles (a sketch of the block, its icon, name and a line) | rows (icon, name, line) -->
<script>
  import Section from '../../src/editor/svelte/Section.svelte';
  import ExplorerHead from '../../src/editor/svelte/ExplorerHead.svelte';
  import Button from '../../src/editor/svelte/Button.svelte';

  let { look = 'tiles', caption = '' } = $props();
  // [type, label, icon, line, sketch]
  const TYPES = [
    ['', 'Empty section', 'square', 'Nothing in it yet: add blocks later', 'empty'],
    ['heading', 'Page heading', 'heading', 'A big title with a short intro', 'title'],
    ['text', 'Text', 'align-left', 'Paragraphs, with a title if you like', 'text'],
    ['photo', 'Photo', 'image', 'One photo, with a caption', 'photo'],
    ['button', 'Button', 'arrow-right', 'A link to a page or a site', 'button'],
    ['form', 'Contact form', 'envelope', 'Name, email and a message', 'form'],
    ['hero', 'Hero', 'star', 'Your name over scattered photos', 'hero'],
    ['statement', 'Statement', 'quote-left', 'One large line of text', 'quote'],
    ['grid', 'Photo grid', 'table-cells', 'Photos from a source list', 'grid'],
    ['albums', 'Album cards', 'images', 'A card per album, to its page', 'cards'],
    ['panels', 'Photo panels', 'table-columns', 'Big panels to your lists', 'panels'],
    ['projects', 'Project list', 'list', 'Rows that open each project', 'rows'],
    ['bio', 'Bio', 'user', 'A portrait with your story', 'bio'],
  ];
  const HOVER = 8; // Photo grid
</script>

<!-- a block's sketch: grey shapes on the card colour, 2:1 -->
{#snippet sketch(kind)}
  <span class="sk sk--{kind}" aria-hidden="true">
    {#if kind === 'empty'}<span class="sk__plus"><i class="fa-solid fa-plus"></i></span>
    {:else if kind === 'title'}<b class="w70 h12"></b><b class="w50 h4"></b><b class="w40 h4"></b>
    {:else if kind === 'text'}<b class="w40 h6"></b><b class="w90 h4"></b><b class="w80 h4"></b><b class="w60 h4"></b>
    {:else if kind === 'photo'}<b class="img"></b><b class="w40 h4"></b>
    {:else if kind === 'button'}<b class="pill"></b>
    {:else if kind === 'form'}<b class="w90 h8 box"></b><b class="w90 h8 box"></b><b class="w90 h16 box"></b>
    {:else if kind === 'hero'}<b class="sc s1"></b><b class="sc s2"></b><b class="sc s3"></b><b class="w70 h12 mid"></b>
    {:else if kind === 'quote'}<b class="w90 h8"></b><b class="w70 h8"></b>
    {:else if kind === 'grid'}<span class="g3">{#each Array(6) as _, i (i)}<b></b>{/each}</span>
    {:else if kind === 'cards'}<span class="g3 tall">{#each Array(3) as _, i (i)}<b></b>{/each}</span>
    {:else if kind === 'panels'}<span class="g2">{#each Array(2) as _, i (i)}<b></b>{/each}</span>
    {:else if kind === 'rows'}{#each Array(4) as _, i (i)}<b class="w90 h6 row"></b>{/each}
    {:else if kind === 'bio'}<span class="bio"><b class="img"></b><span><b class="w90 h6"></b><b class="w80 h4"></b><b class="w60 h4"></b></span></span>
    {/if}
  </span>
{/snippet}

<div class="frame">
  <p class="cap">{caption}</p>
  <div class="stage">
    <!-- the editor's panel behind it, with the (a) card -->
    <div class="panel">
      <Section title="Section 1" name="Eeliya Rasta" open={false}>
        {#snippet bar()}<input type="checkbox" class="switch" checked aria-label="Show" />{/snippet}
      </Section>
      <Section title="Section 2" name="Statement" open={false}>
        {#snippet bar()}<input type="checkbox" class="switch" checked aria-label="Show" />{/snippet}
      </Section>
      <button type="button" class="add is-open"><i class="fa-solid fa-plus" aria-hidden="true"></i>Add section</button>
    </div>
    <div class="scrim"></div>

    <div class="modal__box am" role="dialog" aria-label="Add section">
      <ExplorerHead title="Add section" icon="fa-plus" crumbs={[{ label: 'after Section 2' }]} onclose={() => {}} />
      <div class="am__body">
        <input class="tf__input am__search" type="search" placeholder="Search blocks" aria-label="Search" />
        {#if look === 'tiles'}
          <ul class="tiles">
            {#each TYPES as [type, label, icon, line, kind], i (type)}
              <li>
                <button type="button" class={['tile', i === HOVER && 'is-active', i === 0 && 'tile--empty']}>
                  {@render sketch(kind)}
                  <span class="tile__name"><i class="fa-solid fa-{icon}" aria-hidden="true"></i>{label}</span>
                  <span class="tile__line">{line}</span>
                </button>
              </li>
            {/each}
          </ul>
        {:else}
          <ul class="rows">
            {#each TYPES as [type, label, icon, line], i (type)}
              <li>
                <button type="button" class={['rowb', i === HOVER && 'is-active']}>
                  <span class="rowb__icon"><i class="fa-solid fa-{icon}" aria-hidden="true"></i></span>
                  <span class="rowb__name">{label}</span>
                  <span class="rowb__line">{line}</span>
                  {#if i === HOVER}<span class="rowb__go">Add <i class="fa-solid fa-arrow-turn-down fa-rotate-90"></i></span>{/if}
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
      <footer class="am__foot">
        <span class="hint small">Click to add it after Section 2 · ↑↓←→ and Enter</span>
        <Button size="small">Cancel</Button>
      </footer>
    </div>
  </div>
</div>

<style lang="scss">
  .frame { display: flex; flex-direction: column; gap: 12px; }
  .cap { margin: 0; color: var(--c-text-muted); font-size: var(--fs-sm); line-height: 16px; }
  .stage { position: relative; width: 1120px; height: 760px; overflow: hidden; border-radius: var(--radius-lg); background: var(--c-bg, #0b0b0b); }
  .panel { position: absolute; right: 0; top: 0; bottom: 0; width: 384px; padding: 16px; display: flex; flex-direction: column; gap: 12px; background: var(--c-surface); }
  .add {
    width: calc(100% + 16px); margin-inline: -8px; height: 40px; display: flex; align-items: center; justify-content: center; gap: 8px;
    border: 1px dashed var(--c-accent); border-radius: var(--radius-lg); background: none; color: var(--c-text-strong);
    font: inherit; font-size: var(--fs-base); font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase;
  }
  .scrim { position: absolute; inset: 0; background: var(--black-a82); }

  // the modal: the Media / Sources window's frame (head, body, foot), a solid panel
  .am {
    position: absolute; left: 50%; top: 50%; translate: -50% -50%;
    width: 1000px; height: 680px; padding: 0; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; overflow: hidden;
  }
  .am__body { overflow: auto; padding: var(--space-4); display: grid; align-content: start; gap: var(--space-3); }
  .am__search { height: 32px; }
  .am__foot { display: flex; align-items: center; gap: var(--space-3); height: 56px; padding: 0 var(--space-4); border-top: 1px solid var(--c-line); .hint { margin: 0 auto 0 0; } }

  // (A) tiles: 4 a row; the active one's ring is a box-shadow (no lift, no size change)
  .tiles { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--space-3); }
  .tile {
    width: 100%; display: grid; gap: var(--space-1); padding: var(--space-2) var(--space-2) var(--space-3);
    border: 0; border-radius: var(--radius-md); text-align: left; font: inherit; color: var(--c-text); cursor: pointer;
    background: var(--c-control); box-shadow: inset 0 0 0 1px var(--c-line);
    &.is-active { box-shadow: 0 0 0 2px var(--c-accent); }
  }
  .tile__name { display: flex; align-items: center; gap: var(--space-2); margin-top: var(--space-1); font-weight: 500; i { width: 16px; color: var(--c-accent); text-align: center; } }
  .tile__line { color: var(--c-text-muted); font-size: var(--fs-sm); line-height: 16px; min-height: 32px; }

  // the sketch: 2:1, the block's shapes in two greys
  .sk { aspect-ratio: 2 / 1; display: flex; flex-direction: column; justify-content: center; gap: 4px; padding: 8px 12px; border-radius: var(--radius-sm); background: var(--c-surface); position: relative; overflow: hidden;
    b { display: block; border-radius: 2px; background: var(--c-fill-active); }
    .w40 { width: 40%; } .w50 { width: 50%; } .w60 { width: 60%; } .w70 { width: 70%; } .w80 { width: 80%; } .w90 { width: 90%; }
    .h4 { height: 4px; } .h6 { height: 6px; } .h8 { height: 8px; } .h12 { height: 12px; } .h16 { height: 16px; }
    .img { width: 100%; flex: 1; }
    .box { background: none; box-shadow: inset 0 0 0 1px var(--c-fill-active); }
    .pill { width: 40%; height: 16px; border-radius: 999px; align-self: center; }
    .g3, .g2 { display: grid; gap: 4px; height: 100%; } .g3 { grid-template-columns: repeat(3, 1fr); } .g2 { grid-template-columns: 1fr 1fr; }
    .g3 b, .g2 b { height: 100%; }
    .sc { position: absolute; width: 16%; aspect-ratio: 3 / 4; } .s1 { left: 8%; top: 12%; } .s2 { right: 10%; top: 8%; } .s3 { left: 40%; bottom: 8%; }
    .mid { position: relative; align-self: center; background: var(--c-text-faint); }
    .bio { display: grid; grid-template-columns: 1fr 1.6fr; gap: 8px; height: 100%; span { display: flex; flex-direction: column; justify-content: center; gap: 4px; } }
  }
  .sk--empty { align-items: center; box-shadow: inset 0 0 0 1px var(--c-line); background: none; border: 1px dashed var(--c-line); }
  .sk__plus { color: var(--c-text-faint); }
  .sk--grid, .sk--cards, .sk--panels { padding: 8px; }

  // (B) rows: 40px, the icon, name, its line; the active one shows where Enter goes
  .rows { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2) var(--space-3); }
  .rowb {
    width: 100%; height: 56px; display: grid; grid-template-columns: 40px 1fr auto; grid-template-rows: 20px 16px; align-content: center; column-gap: var(--space-3);
    padding: 0 var(--space-3) 0 var(--space-2); border: 0; border-radius: var(--radius-md); text-align: left; font: inherit; color: var(--c-text); cursor: pointer;
    background: var(--c-control); box-shadow: inset 0 0 0 1px var(--c-line);
    &.is-active { box-shadow: 0 0 0 2px var(--c-accent); }
  }
  .rowb__icon { grid-row: 1 / 3; width: 40px; height: 40px; display: grid; place-items: center; border-radius: var(--radius-sm); background: var(--c-surface); color: var(--c-accent); }
  .rowb__name { font-weight: 500; line-height: 20px; }
  .rowb__line { grid-column: 2; color: var(--c-text-muted); font-size: var(--fs-sm); line-height: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rowb__go { grid-column: 3; grid-row: 1 / 3; align-self: center; color: var(--c-accent); font-size: var(--fs-sm); }
</style>
