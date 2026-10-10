<!--
  One block's motion (its `motion` in the page file, src/site/layout/motion.js): Replay and a
  scroll slider for it in the preview, its animation (none, or one of the library's that works
  on any block) and its own timing, each field with a Custom switch (MotionGroups, scope
  'block': off shows the animation's value, dimmed). What the animation does is read-only here:
  it is edited in the Animations sub-tab (Edit). Below, the block's parts with their own
  animation (data-anim inside it: the hero's photos, a heading's title, ...), each opening in
  the Motion tab.
  Used by the Motion tab (MotionPanel) and the block inspector's Motion tab (BlockInspector).
    file, at, j   where the block is: sections[at].blocks[j] of the page file
    el            its element in the preview (null when not shown)
    onlibrary     (name) open the animation in the Animations sub-tab
    onpart        (el) open a part in the Motion tab
-->
<script>
  import Button from './Button.svelte';
  import MotionGroups from './MotionGroups.svelte';
  import Select from './Select.svelte';
  import { GENERIC_TYPES, blockModel } from './motion.js';

  let { live, bridge, gsap, cfg, file, at, j, el = null, onlibrary, onpart } = $props();

  const base = $derived(`/sections/${at}/blocks/${j}`);
  const motion = $derived.by(() => {
    live.version;
    const m = live.get(file, `${base}/motion`);
    return m && typeof m === 'object' ? { ...m } : null;
  });
  const m = $derived(blockModel(cfg, motion));
  const known = $derived(!!cfg.presets[m.presetName]);
  const own = $derived(Object.keys(m.own).length > 0);
  const options = $derived([
    { value: '', label: 'none', hint: 'no motion' },
    ...Object.entries(cfg.presets)
      .filter(([name, p]) => GENERIC_TYPES.has(p.type) || name === m.presetName)
      .map(([name, p]) => ({ value: name, label: name, hint: p.type })),
  ]);
  // the parts of the block with their own animation (data-anim inside it)
  const parts = $derived.by(() => {
    live.version;
    return el ? [...el.querySelectorAll('[data-anim]')] : [];
  });

  /** Pick the animation (its own timing stays); '' removes the block's motion. */
  function setAnim(anim) {
    if (!anim) live.store.remove(file, `${base}/motion`, { keep: 4, source: 'motion-structure' });
    else
      live.store.set(file, `${base}/motion`, { ...motion, anim }, { source: 'motion-structure' });
  }
  /** Back to the animation's timing: one undo step. */
  const inheritAll = () =>
    live.store.set(file, `${base}/motion`, { anim: m.presetName }, { source: 'motion-structure' });

  // Scroll position of the block in the preview, 0-100 (read when it is shown).
  const scrolled = () => (el ? Math.round(bridge.scrubProgress(el) * 100) : 0);
  let progress = $state(scrolled());
</script>

{#if el}
  <div class="bm__actions">
    <Button size="small" icon="play" disabled={!motion} onclick={() => bridge.replayOne(el)}
      >Replay</Button
    >
    <label
      class="scrub"
      title="Scroll the page through this block (0% = entering at the bottom, 100% = leaving at the top)"
    >
      <span class="scrub__label">Scroll</span>
      <input
        type="range"
        min="0"
        max="100"
        step="0.5"
        class="scrub__range"
        bind:value={progress}
        oninput={() => bridge.scrubTo(el, progress / 100)}
      />
      <span class="scrub__val">{Math.round(progress)}%</span>
    </label>
  </div>
{/if}

<div class="f">
  <div class="f__top">
    <span class="f__label">Animation</span>
    {#if motion && known}
      <Button
        size="small"
        icon="pen-to-square"
        iconOnly
        label="Edit {m.presetName} in Animations"
        onclick={() => onlibrary(m.presetName)}
      />
    {/if}
  </div>
  <Select aria-label="Animation" value={motion?.anim ?? ''} {options} onchange={setAnim} />
</div>

{#if motion && !known}
  <p class="hint small">
    There is no animation “{motion.anim}” in the library: pick another one, or Save will refuse it.
  </p>
{:else if motion}
  <p class="hint small">
    What {m.presetName} does is set in Animations. Turn on a field's switch to give this block its own
    timing.
  </p>
  {#key `${file}#${base}`}
    <MotionGroups {live} {gsap} {m} scope="block" {file} ptr="{base}/motion" key="block" />
  {/key}
  {#if own}
    <Button size="small" icon="rotate-left" onclick={inheritAll}>Use the animation's timing</Button>
  {/if}
{:else}
  <p class="hint small">This block doesn't move. Pick an animation to give it one.</p>
{/if}

{#if parts.length}
  <h4 class="bm__parts">Parts with their own animation</h4>
  <ul class="list">
    {#each parts as part, i (i)}
      <li>
        <button type="button" class="bm__part" onclick={() => onpart(part)}>
          <span>{part.dataset.anim}</span>
          <span class="muted">{bridge.api?.resolve(part.dataset.anim, part)?.preset || '?'}</span>
        </button>
      </li>
    {/each}
  </ul>
{/if}

<style lang="scss">
  .bm__actions {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 16px;
  }

  .scrub {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--muted);
  }

  .scrub__label {
    font-size: 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .scrub__val {
    width: 36px;
    text-align: right;
    color: var(--fg);
  }

  .bm__parts {
    margin: 16px 0 8px;
    color: var(--muted);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .bm__part {
    width: 100%;
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 12px;
    line-height: 16px;
    border: 0;
    border-radius: 12px;
    cursor: pointer;
    text-align: left;
    background: rgb(255 255 255 / 0.03);
    box-shadow: inset 0 0 0 1px var(--line);

    &:hover {
      background: rgb(255 255 255 / 0.08);
    }
  }
</style>
