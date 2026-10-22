<!--
  One toolbar, on the selected widget only (ui.widget, Content tab), over the preview: drawn on
  the stage (App.svelte) at the widget's top left edge, above it (below it when there is no
  room, inside it when it is taller than the frame), never moving the page. Two parts:

    text      (a Text widget) style ▾ (the line the caret is in: the whole line), B, I, link
              (the selected text only: greyed with nothing selected or when not editing),
              + Field (a field of the item the widget shows, or a count, at the caret)
    | layout  Size ▾ (Auto | Aspect with its ratios and a custom w:h | Rows), Text size ▾
              (its styles' sizes | Scale with the grid, % | Fit to widget: fixed heights
              only), Layer (down / up: [ and ]; the phone: Reset phone instead), Info
              (where it is, what it follows)

  A widget without text has the layout part only. A narrow widget puts the layout part into a
  "…" menu first, then the text marks too. The edit itself is bridge.js's (rich.js); the
  layout edits layout-ops.js's, one undo step each.
-->
<script>
  import { ui } from './ui.svelte.js';
  import { layerWidget, resetMobile, setWidget } from '../layout-ops.js';
  import { targetFile } from '../layout-sync.js';
  import { schemaFor } from './source-items.js';
  import {
    ASPECTS,
    linkOf,
    phoneAreaOf,
    placeOf,
    baseOf,
    ratioOf,
    sizeOf,
  } from '../../site/layout/index.js';
  import { SCALE_TYPES, adjustOf } from '../../site/layout/type.js';
  import { WIDGET_TYPES } from '../../site/widgets/index.js';
  import { sourceFile, sourceIds as sourceIdsOf } from '../../site/files.js';
  import { sourceOf } from '../../site/layout/source.js';
  import { untrack } from 'svelte';
  import { isSafeHref, UNSAFE_HREF } from '../../site/hrefs.js';
  import {
    LINE_STYLES,
    insertRun,
    lineLength,
    setLink,
    setStyle,
    styleLabel,
    toggleMark,
  } from '../../site/text.js';
  import { nameOf } from './content-groups.js';
  import { MOD } from '../lib/format.js';

  let { live, bridge } = $props();

  // ---- the widget: where it is in its file, its stored value, its element in the preview
  const where = $derived.by(() => {
    live.version;
    ui.previewVersion;
    const id = ui.widget;
    if (!id || ui.mode !== 'text') return null;
    const file = targetFile(ui.target, bridge.doc);
    const list = live.get(file, '/sections') || [];
    for (const [at, s] of list.entries()) {
      const j = (s?.widgets || []).findIndex((b) => b?.id === id);
      if (j >= 0) return { id, file, at, j, base: `/sections/${at}/widgets/${j}` };
    }
    return null;
  });
  const widget = $derived.by(() => {
    live.version;
    return where ? live.get(where.file, where.base) || {} : null;
  });
  const type = $derived(WIDGET_TYPES[widget?.type] || {});
  const hasText = $derived(!!type.fields?.some((f) => f.type === 'rich'));
  const scalable = $derived(SCALE_TYPES.includes(widget?.type));
  const phone = $derived(ui.viewport === 'mobile');
  const size = $derived(sizeOf(widget));
  const rich = $derived(ui.rich && ui.rich.widget === where?.id ? ui.rich : null);
  const editing = $derived(!!rich);
  const style = $derived(rich ? rich.style : widget?.body?.[0]?.style || 'paragraph');
  const bodyRef = $derived(where ? { file: where.file, ptr: `${where.base}/body` } : null);

  // ---- where it is drawn: the widget's box in the frame, on the stage, every frame
  let box = $state(null); // { x, y, w, h, frameTop, frameBottom }
  let shownRows = $state(null);
  let hidden = $state(false);
  $effect(() => {
    if (!where) return void (box = null);
    const id = where.id;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const doc = bridge.doc;
      const frame = doc?.defaultView?.frameElement;
      const el = doc?.querySelector(`[data-widget="${CSS.escape(id)}"]`);
      const stage = frame?.parentElement;
      if (!el || !stage) return void (box = null);
      const r = el.getBoundingClientRect();
      const f = frame.getBoundingClientRect();
      const s = stage.getBoundingClientRect();
      const next = {
        x: Math.round(f.left - s.left + r.left),
        y: Math.round(f.top - s.top + r.top),
        w: Math.round(r.width),
        h: Math.round(r.height),
        frameTop: Math.round(f.top - s.top),
        frameBottom: Math.round(f.bottom - s.top),
        frameLeft: Math.round(f.left - s.left),
        frameRight: Math.round(f.right - s.left),
      };
      if (!box || Object.keys(next).some((k) => next[k] !== box[k])) box = next;
      // a drag in the preview (overlay.js holds the rows): out of the way
      const drag = doc.documentElement.hasAttribute('data-flow-hold');
      if (drag !== hidden) hidden = drag;
      const v = (k) => parseInt(el.style.getPropertyValue(k), 10);
      const rows = { row: v('--fr'), rows: v('--frs') };
      if (shownRows?.row !== rows.row || shownRows?.rows !== rows.rows) shownRows = rows;
    };
    tick();
    return () => cancelAnimationFrame(raf);
  });

  // its toolbar's width (measured), for where it goes and what moves into "…"
  let barW = $state(0);
  const TEXT_W = 340; // style + B I link + Field, about
  const level = $derived.by(() => {
    if (!box) return 0;
    const room = Math.max(box.w, 280);
    const full = (hasText ? TEXT_W + 16 : 0) + 200;
    if (room >= full) return 0; // everything
    if (!hasText || room >= TEXT_W + 48) return 1; // the layout part in "…"
    return 2; // the marks too
  });
  const BAR_H = 40;
  const pos = $derived.by(() => {
    if (!box) return null;
    const above = box.y - BAR_H - 8;
    const below = box.y + box.h + 12;
    let y;
    let flip = false;
    let side = 'inside';
    if (above >= box.frameTop + 8) {
      y = above;
      side = 'above';
    } else if (below + BAR_H <= box.frameBottom - 8) {
      y = below;
      flip = true;
      side = 'below';
    } else y = Math.max(box.frameTop + 8, box.y + 8); // taller than the frame: inside its top
    const x = Math.min(
      Math.max(box.x, box.frameLeft + 8),
      Math.max(box.frameLeft + 8, box.frameRight - 8 - barW),
    );
    return { x, y, flip, side };
  });

  // the preview's label of the selected text steps aside on the toolbar's side (no shift)
  $effect(() => {
    const side = where && widget && pos && !hidden ? pos.side : null;
    bridge.toolbarSide(side);
    return () => bridge.toolbarSide(null);
  });

  // ---- menus: one open at a time; a click elsewhere (here or in the preview) closes it
  let open = $state(null);
  const toggle = (name) => (open = open === name ? null : name);
  $effect(() => {
    if (!open) return;
    const close = (e) => {
      if (e.target?.closest?.('.btb')) return;
      // the link box held the edit open: a click elsewhere cancels it and lets go
      if (open === 'link') bridge.releaseRich(e.target);
      open = null;
    };
    const doc = bridge.doc;
    window.addEventListener('pointerdown', close, true);
    doc?.addEventListener('pointerdown', close, true);
    return () => {
      window.removeEventListener('pointerdown', close, true);
      doc?.removeEventListener('pointerdown', close, true);
    };
  });
  $effect(() => {
    where?.id;
    // another widget picked while the link box held the edit open: it lets go, the edit ends
    untrack(() => {
      if (open === 'link') bridge.releaseRich(null);
      open = null;
    });
  });
  // the edit ended (a click elsewhere in the preview): the link box goes with it
  $effect(() => {
    if (!rich && untrack(() => open) === 'link') open = null;
  });
  // Ctrl+K while editing: the link box
  $effect(() =>
    bridge.on('richLink', () => {
      if (rich?.selected) openLink();
    }),
  );

  // the toolbar keeps the preview's focus (the caret stays): its buttons don't take it
  const keepFocus = (e) => {
    if (!e.target.closest?.('input')) e.preventDefault();
  };

  // ---- text
  const apply = (fn) => bridge.richApply(fn, bodyRef);
  function pickStyle(s) {
    open = null;
    const line = rich ? rich.line : 0;
    apply((body) => ({ body: setStyle(body, line, s) }));
  }
  const mark = (m) =>
    apply((body, sel) => (sel ? { body: toggleMark(body, sel.from, sel.to, m) } : null));

  let linkText = $state('');
  function openLink() {
    linkText = rich?.link?.href ?? '';
    bridge.holdRich(true);
    open = 'link';
  }
  const linkError = $derived(linkText.trim() && !isSafeHref(linkText.trim()) ? UNSAFE_HREF : '');
  function saveLink(e) {
    e?.preventDefault();
    if (linkError) return;
    const href = linkText.trim();
    open = null;
    bridge.holdRich(false);
    apply((body, sel) =>
      sel ? { body: setLink(body, sel.from, sel.to, href ? { href } : null) } : null,
    );
  }
  function cancelLink() {
    open = null;
    bridge.holdRich(false);
  }

  // + Field: the item's fields (the widget's source), and counts of the sources
  const from = $derived(sourceOf(widget)?.from ?? null);
  const fields = $derived.by(() => {
    live.version;
    return from
      ? (schemaFor(live.store, sourceFile(from))?.fields || []).filter((f) =>
          ['text', 'choice', 'number', 'date', 'longtext'].includes(f.type),
        )
      : [];
  });
  const sources = $derived.by(() => {
    live.version;
    return sourceIdsOf(live.store.current);
  });
  function insert(run) {
    open = null;
    apply((body, sel) => {
      if (!sel) return null;
      const at = sel.to.line < body.length ? sel.to : { line: 0, at: lineLength(body[0]) };
      const next = { line: at.line, at: at.at + 1 };
      return { body: insertRun(body, at, run), sel: { from: next, to: next } };
    });
  }

  // ---- layout (as the Layout tab had it)
  const area = $derived.by(() => {
    if (!widget) return null;
    const a = phone ? phoneAreaOf(widget) : placeOf(baseOf(widget));
    const ok = (n) => Number.isInteger(n) && n > 0;
    return {
      ...a,
      row: ok(shownRows?.row) ? shownRows.row : a.row,
      rows: ok(shownRows?.rows) ? shownRows.rows : a.rows,
    };
  });
  const link = $derived(widget ? linkOf(widget, phone) : null);
  const leaderName = $derived.by(() => {
    if (!link || !where) return '';
    const s = live.get(where.file, `/sections/${where.at}`) || {};
    const leader = (s.widgets || []).find((b) => b?.id === link.to);
    return leader ? nameOf(leader) || WIDGET_TYPES[leader.type]?.label || leader.id : link.to;
  });
  const phoneSet = $derived.by(() => {
    live.version;
    const s = where && live.get(where.file, `/sections/${where.at}`);
    return !!s?.widgets?.some((b) => b?.layout?.phone !== undefined);
  });
  const SIZES = [
    ['auto', 'Auto', 'As tall as its content'],
    ['aspect', 'Aspect', 'Its width × a ratio'],
    ['rows', 'Rows', 'Its rows, fixed'],
  ];
  const set = (patch, key) => setWidget(live.store, where.file, where.at, where.j, patch, key);
  function setSize(next) {
    if (next === size) return;
    set({
      size: next === 'auto' ? undefined : next,
      aspect: next === 'aspect' ? widget.aspect || '4:5' : undefined,
      rows: next === 'auto' ? undefined : area.rows,
    });
  }
  let ratioText = $state('');
  const customRatio = $derived(!!widget?.aspect && !ASPECTS.includes(widget.aspect));
  function typeRatio(v) {
    ratioText = v;
    if (ratioOf(v)) set({ aspect: v.trim() }, `layout:${where.file}#${where.base}/aspect`);
  }
  // text size: the styles' (none), scaled with the grid (on, adjust) or fitted (fit)
  const tsize = $derived(widget?.scale?.fit ? 'fit' : widget?.scale?.on ? 'scale' : 'fixed');
  const canFit = $derived(size !== 'auto');
  function setTextSize(mode, adjust) {
    const a = adjust ?? widget.scale?.adjust ?? 100;
    const next =
      mode === 'fixed'
        ? undefined
        : mode === 'fit'
          ? { fit: true }
          : { on: true, ...(a !== 100 ? { adjust: a } : {}) };
    set(
      { scale: next },
      adjust !== undefined ? `layout:${where.file}#${where.base}/scale` : undefined,
    );
  }
  const layer = (dir) => layerWidget(live.store, where.file, where.at, where.j, dir);

  const sizeLabel = $derived(
    size === 'aspect' ? widget?.aspect || '4:5' : SIZES.find(([s]) => s === size)?.[1],
  );
</script>

{#snippet styleMenu()}
  <div class="btb__menu" role="listbox" aria-label="Style of this line">
    <span class="btb__grp">{editing ? 'This line' : 'Its first line'} · Settings › Typography</span>
    {#each LINE_STYLES as [s, label, tag] (s)}
      <button
        type="button"
        role="option"
        aria-selected={s === style}
        class={['btb__opt', s === style && 'is-on']}
        onclick={() => pickStyle(s)}
        ><span class="sty sty--{s}">{label}</span><span class="btb__hint">{tag.toUpperCase()}</span
        >{#if s === style}<i class="fa-solid fa-check" aria-hidden="true"></i>{/if}</button
      >
    {/each}
  </div>
{/snippet}

{#snippet marks()}
  <button
    type="button"
    class={['btb__btn btb__icon', rich?.bold && 'is-on']}
    disabled={!rich?.selected}
    aria-label="Bold"
    aria-pressed={!!rich?.bold}
    title="Bold ({MOD}+B): the selected text"
    onclick={() => mark('b')}><i class="fa-solid fa-bold" aria-hidden="true"></i></button
  >
  <button
    type="button"
    class={['btb__btn btb__icon', rich?.italic && 'is-on']}
    disabled={!rich?.selected}
    aria-label="Italic"
    aria-pressed={!!rich?.italic}
    title="Italic ({MOD}+I): the selected text"
    onclick={() => mark('i')}><i class="fa-solid fa-italic" aria-hidden="true"></i></button
  >
  <button
    type="button"
    class={['btb__btn btb__icon', rich?.link && 'is-on']}
    disabled={!rich?.selected}
    aria-label="Link"
    title="Link ({MOD}+K): the selected text"
    onclick={openLink}><i class="fa-solid fa-link" aria-hidden="true"></i></button
  >
  <button
    type="button"
    class={['btb__btn btb__field', open === 'field' && 'is-open']}
    disabled={!editing}
    title="A field of the item it shows, or a count, at the caret"
    onclick={() => toggle('field')}
    ><i class="fa-solid fa-plus" aria-hidden="true"></i><span>Field</span></button
  >
{/snippet}

{#snippet sizePanel()}
  <span class="btb__grp">Size</span>
  <div class="seg" role="radiogroup" aria-label="Size">
    {#each SIZES as [id, label, title] (id)}
      <button
        type="button"
        role="radio"
        aria-checked={size === id}
        {title}
        class={['seg__btn', size === id && 'is-active']}
        onclick={() => setSize(id)}>{label}</button
      >
    {/each}
  </div>
  {#if size === 'aspect'}
    <span class="btb__grp">Ratio (width:height)</span>
    <div class="seg btb__ratios" role="radiogroup" aria-label="Aspect ratio">
      {#each ASPECTS as r (r)}
        <button
          type="button"
          role="radio"
          aria-checked={widget.aspect === r}
          class={['seg__btn', (widget.aspect ?? '4:5') === r && 'is-active']}
          onclick={() => set({ aspect: r })}>{r}</button
        >
      {/each}
    </div>
    <label class="btb__row">
      <span class="btb__hint">Custom</span>
      <input
        class="tf__input btb__input"
        placeholder="5:7"
        value={customRatio ? widget.aspect : ratioText}
        aria-label="Custom ratio (width:height)"
        aria-invalid={ratioText !== '' && !ratioOf(ratioText)}
        oninput={(e) => typeRatio(e.currentTarget.value)}
      />
    </label>
  {/if}
{/snippet}

{#snippet textSizePanel()}
  <span class="btb__grp">Text size</span>
  <div class="seg btb__tsize" role="radiogroup" aria-label="Text size">
    <button
      type="button"
      role="radio"
      aria-checked={tsize === 'fixed'}
      class={['seg__btn', tsize === 'fixed' && 'is-active']}
      title="Its styles' sizes (Settings › Typography)"
      onclick={() => setTextSize('fixed')}>Styles</button
    >
    <button
      type="button"
      role="radio"
      aria-checked={tsize === 'scale'}
      class={['seg__btn', tsize === 'scale' && 'is-active']}
      title="In cells: it grows and shrinks with the grid, never under its styles' minimum"
      onclick={() => setTextSize('scale')}>Scale</button
    >
    <button
      type="button"
      role="radio"
      aria-checked={tsize === 'fit'}
      class={['seg__btn', tsize === 'fit' && 'is-active']}
      disabled={!canFit}
      title={canFit
        ? 'As large as fits the widget'
        : 'Fit needs a fixed height: Size Aspect or Rows'}
      onclick={() => setTextSize('fit')}>Fit to widget</button
    >
  </div>
  {#if tsize === 'scale'}
    <label class="btb__row">
      <span class="btb__hint">% of its styles</span>
      <input
        class="tf__input btb__input"
        type="number"
        min="10"
        max="1000"
        value={Math.round(adjustOf(widget) * 100)}
        aria-label="Text size, % of its styles"
        oninput={(e) => {
          const v = Number(e.currentTarget.value);
          if (v >= 10 && v <= 1000) setTextSize('scale', v);
        }}
      />
    </label>
  {:else if !canFit}
    <p class="btb__note">Fit to widget needs a fixed height: Size Aspect or Rows.</p>
  {/if}
{/snippet}

{#snippet layerPanel()}
  {#if !phone}
    <span class="btb__grp">Layer</span>
    <div class="btb__pair">
      <button type="button" class="btb__opt" onclick={() => layer(-1)}
        ><i class="fa-solid fa-arrow-down" aria-hidden="true"></i><span>Down</span><kbd>[</kbd
        ></button
      >
      <button type="button" class="btb__opt" onclick={() => layer(1)}
        ><i class="fa-solid fa-arrow-up" aria-hidden="true"></i><span>Up</span><kbd>]</kbd></button
      >
    </div>
  {:else}
    <button
      type="button"
      class="btb__opt"
      disabled={!phoneSet}
      onclick={() => resetMobile(live.store, where.file, where.at)}
      ><i class="fa-solid fa-rotate-left" aria-hidden="true"></i><span>Reset phone</span></button
    >
  {/if}
{/snippet}

{#snippet infoPanel()}
  <span class="btb__grp">{phone ? 'Phone layout' : 'Desktop layout'}</span>
  <span class="btb__info">col {area.col} · row {area.row} · {area.span} × {area.rows}</span>
  <span class="btb__info"
    >{#if link}follows {leaderName}, gap {link.gap}{:else}free (not linked){/if}</span
  >
  <span class="btb__hint"
    >Drag it to move, its handles to resize, its top circle onto another widget's bottom circle to
    link it.</span
  >
{/snippet}

{#snippet layoutPart()}
  <button
    type="button"
    class={['btb__btn', open === 'size' && 'is-open']}
    title="Size: Auto, Aspect or Rows"
    onclick={() => toggle('size')}
    ><i class="fa-solid fa-up-down" aria-hidden="true"></i><span>{sizeLabel}</span><i
      class="fa-solid fa-chevron-down btb__caret"
      aria-hidden="true"
    ></i></button
  >
  {#if scalable}
    <button
      type="button"
      class={['btb__btn btb__icon', (open === 'tsize' || tsize !== 'fixed') && 'is-open']}
      aria-label="Text size"
      title="Text size: its styles, scaled with the grid, or fit to widget"
      onclick={() => toggle('tsize')}
      ><i class="fa-solid fa-text-height" aria-hidden="true"></i></button
    >
  {/if}
  {#if phone}
    <button
      type="button"
      class="btb__btn"
      disabled={!phoneSet}
      title="The section's widgets show their desktop layout halved again"
      onclick={() => resetMobile(live.store, where.file, where.at)}
      ><i class="fa-solid fa-rotate-left" aria-hidden="true"></i><span>Reset phone</span></button
    >
  {:else}
    <button
      type="button"
      class={['btb__btn btb__icon', open === 'layer' && 'is-open']}
      aria-label="Layer"
      title="Layer: [ down, ] up"
      onclick={() => toggle('layer')}
      ><i class="fa-solid fa-layer-group" aria-hidden="true"></i></button
    >
  {/if}
  <button
    type="button"
    class={['btb__btn btb__icon', open === 'info' && 'is-open']}
    aria-label="Where it is"
    title="Where it is"
    onclick={() => toggle('info')}
    ><i class="fa-solid fa-circle-info" aria-hidden="true"></i></button
  >
{/snippet}

{#if where && widget && pos && !hidden}
  <div
    class={['btb', pos.flip && 'is-below']}
    style="left: {pos.x}px; top: {pos.y}px"
    bind:clientWidth={barW}
    onpointerdown={keepFocus}
    onmousedown={keepFocus}
    role="presentation"
  >
    <div class="btb__bar" role="toolbar" aria-label="Widget">
      {#if hasText}
        <button
          type="button"
          class={['btb__btn btb__style', open === 'style' && 'is-open']}
          title="The style of the line the caret is in (the whole line)"
          onclick={() => toggle('style')}
          ><span>{styleLabel(style)}</span><i
            class="fa-solid fa-chevron-down btb__caret"
            aria-hidden="true"
          ></i></button
        >
        {#if level < 2}{@render marks()}{/if}
        {#if level === 0}<span class="btb__vdiv" aria-hidden="true"></span>{/if}
      {/if}
      {#if level === 0}{@render layoutPart()}{/if}
      {#if level > 0}
        <button
          type="button"
          class={['btb__btn btb__icon', open === 'more' && 'is-open']}
          aria-label="More"
          title="More: size, text size, layer"
          onclick={() => toggle('more')}
          ><i class="fa-solid fa-ellipsis" aria-hidden="true"></i></button
        >
      {/if}
    </div>

    {#if open}
      <div
        class={[
          'btb__pop',
          open === 'style' && 'is-list',
          (open === 'tsize' || open === 'more') && 'is-wide',
        ]}
      >
        {#if open === 'style'}
          {@render styleMenu()}
        {:else if open === 'size'}
          {@render sizePanel()}
        {:else if open === 'tsize'}
          {@render textSizePanel()}
        {:else if open === 'layer'}
          {@render layerPanel()}
        {:else if open === 'info'}
          {@render infoPanel()}
        {:else if open === 'link'}
          <form class="btb__row" onsubmit={saveLink}>
            <input
              class="tf__input btb__input btb__url"
              placeholder="https://… or /about/ (empty: no link)"
              aria-label="Link address"
              class:is-invalid={!!linkError}
              aria-invalid={!!linkError}
              bind:value={linkText}
              {@attach (el) => el.focus()}
              onkeydown={(e) => e.key === 'Escape' && (e.stopPropagation(), cancelLink())}
            />
            <button type="submit" class="btb__btn" disabled={!!linkError}>Link</button>
          </form>
          {#if linkError}<p class="btb__err" role="alert">{linkError}</p>{/if}
        {:else if open === 'field'}
          <span class="btb__grp">{from ? `A field of ${from}` : 'No source: no fields'}</span>
          {#each fields as f (f.key)}
            <button type="button" class="btb__opt" onclick={() => insert({ field: f.key })}
              ><span class="btb__chip">{f.key}</span><span class="btb__hint"
                >{f.label || f.type}</span
              ></button
            >
          {/each}
          <span class="btb__grp">A count</span>
          {#if from}
            <button
              type="button"
              class="btb__opt"
              onclick={() => insert({ count: { of: 'items' } })}
              ><span class="btb__chip">#items</span><span class="btb__hint">the ones it shows</span
              ></button
            >
          {/if}
          {#each sources as s (s)}
            <button type="button" class="btb__opt" onclick={() => insert({ count: { source: s } })}
              ><span class="btb__chip">#{s}</span><span class="btb__hint">items in {s}</span
              ></button
            >
          {/each}
        {:else if open === 'more'}
          {#if level === 2 && hasText}
            <div class="btb__bar btb__bar--inner">{@render marks()}</div>
          {/if}
          {@render sizePanel()}
          {#if scalable}{@render textSizePanel()}{/if}
          {@render layerPanel()}
          {@render infoPanel()}
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style lang="scss">
  @use '../styles/mixins' as *;

  .btb__err {
    max-width: 320px;
    margin: 0;
    padding: 0 var(--space-2) var(--space-2);
    color: var(--c-danger);
    font-size: var(--fs-xs);
  }

  .btb {
    position: absolute;
    z-index: 20;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-1);
  }

  // above the widget: its menus open below the bar; under it the same
  .btb__bar {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1);
    border-radius: var(--radius-md);
    background: var(--c-card);
    color: var(--c-text);
    box-shadow:
      inset 0 0 0 1px var(--c-line),
      0 8px 24px var(--black-a40);
  }

  .btb__bar--inner {
    padding: 0;
    box-shadow: none;
  }

  .btb__btn {
    display: flex;
    flex: none;
    align-items: center;
    gap: var(--space-2);
    height: 32px;
    padding: 0 var(--space-2);
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: inherit;
    font: inherit;
    font-size: var(--fs-base);
    white-space: nowrap;
    cursor: pointer;

    &:hover:not(:disabled) {
      background: var(--c-hover);
    }

    &:disabled {
      color: var(--c-text-faint);
      cursor: default;
    }

    &:focus-visible {
      @include focus-ring;
    }

    &.is-on,
    &.is-open {
      background: var(--c-hover);
    }

    &.is-on {
      color: var(--c-text-strong);
      box-shadow: inset 0 0 0 1px var(--c-line);
    }
  }

  .btb__icon {
    justify-content: center;
    width: 32px;
    padding: 0;
  }

  .btb__style {
    justify-content: space-between;
    width: 112px;
  }

  .btb__field:not(:disabled) {
    color: var(--c-widget-accent);
  }

  .btb__caret {
    font-size: var(--fs-2xs);
  }

  .btb__vdiv {
    width: 1px;
    height: 24px;
    margin-inline: var(--space-1);
    background: var(--c-line-strong, var(--c-line));
  }

  .btb__pop {
    @include stack(var(--space-2));
    width: 280px;
    padding: var(--space-2);
    border-radius: var(--radius-md);
    background: var(--c-card);
    box-shadow:
      inset 0 0 0 1px var(--c-line),
      0 8px 24px var(--black-a40);

    // the text size's three choices in full (Fit to widget)
    &.is-wide {
      width: 320px;
    }

    &.is-list {
      gap: 0;
      width: 248px;
      padding: var(--space-1);
    }
  }

  .btb__grp {
    padding: var(--space-1) var(--space-1) 0;
    color: var(--c-text-faint);
    font-size: var(--fs-2xs);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .btb__opt {
    @include row(var(--space-2));
    width: 100%;
    min-height: 32px;
    padding: 0 var(--space-2);
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--c-text);
    font: inherit;
    font-size: var(--fs-base);
    text-align: left;
    cursor: pointer;

    &:hover:not(:disabled),
    &.is-on {
      background: var(--c-hover);
    }

    &:disabled {
      color: var(--c-text-faint);
      cursor: default;
    }

    > span:first-of-type {
      flex: 1;
    }

    kbd {
      color: var(--c-text-muted);
      font-size: var(--fs-xs);
    }
  }

  .btb__pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-1);
  }

  // the text size's choices: as wide as their words, the rest shared
  .btb__tsize :global(.seg__btn) {
    flex: 1 1 auto;
    padding-inline: var(--space-3);
  }

  // help under a control, in line with the group titles
  .btb__note {
    margin: 0;
    padding: 0 var(--space-1);
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
    line-height: 16px;
  }

  .btb__hint {
    color: var(--c-text-muted);
    font-size: var(--fs-xs);
  }

  .btb__info {
    padding-inline: var(--space-1);
    font-variant-numeric: tabular-nums;
  }

  .btb__row {
    @include row(var(--space-2));

    .btb__hint {
      flex: none;
    }
  }

  .btb__input {
    flex: 1;
    min-width: 0;
    height: 32px;
  }

  .btb__url {
    width: 220px;
  }

  .btb__ratios {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
  }

  .btb__chip {
    flex: none !important;
    padding: 0 var(--space-1);
    border-radius: var(--radius-xs);
    background: color-mix(in srgb, var(--c-widget-accent) 16%, transparent);
    color: var(--c-widget-accent);
  }

  // the styles as they look, small
  .sty--title {
    font-size: var(--fs-xl);
    font-weight: 600;
  }

  .sty--heading {
    font-size: var(--fs-lg);
    font-weight: 600;
  }

  .sty--subheading {
    font-weight: 600;
  }

  .sty--statement {
    font-size: var(--fs-md);
  }

  .sty--label {
    font-size: var(--fs-2xs);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .sty--small {
    font-size: var(--fs-xs);
  }
</style>
