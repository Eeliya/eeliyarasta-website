<!--
  A block's source, first in its Content tab (BlockInspector.svelte; src/site/layout/source.js):
    Source       Item / All (a list block) · From URL · None, one segmented row; From URL only on
                 a [param] page (greyed elsewhere, its tooltip says why)
    the item     Item: the item selector (ItemPicker.svelte, an item); All and From URL: its
                 source (the same selector, a list)
    Match the address
                 From URL: a row per param of the page's address, [ where | [person] | = | field ▾ ]:
                 the source field it must equal (default: the field of the same name, else slug),
                 or Any (no rule: not filtered; not on the main block, the menu says why). A
                 field the source doesn't have: the row in red and a note under the rows
    what it shows  one line: how many items match (the fields show the first)
    Main block   on a [param] page: a switch, on: this block decides which pages exist (the
                 page's "main"; turning it on makes it From URL), its hint how many are built
  Stored as the block's "source" ({ mode, from, id | where }), every change one undo step that
  renders the block again. ui.focusParam (the page head's warning) focuses a param's row.
-->
<script>
  import { tick } from 'svelte';
  import ItemPicker from './ItemPicker.svelte';
  import Select from './Select.svelte';
  import { ui } from './ui.svelte.js';
  import { schemaFor, itemName } from './source-items.js';
  import { plural } from '../lib/format.js';
  import { isTemplate, pageIdOf, paramsOf, sourceFile } from '../../site/files.js';
  import { mainProblem, sourceOf, urlSource } from '../../site/layout/source.js';
  import { isBinding, resolve } from '../../site/layout/bindings.js';
  import { defaultField, hasField, ruleOf, SLUG } from '../../site/query.js';

  // g: the block's group; base: its pointer; list: a list block (All instead of Item); shown:
  // what it shows on the page in the preview (blockItems)
  let { g, live, base, list = false, shown, sourceIds, onsource } = $props();

  const NO_PARAMS = 'This page’s address has no params to match';
  const ANY_WHY =
    'Not on the main block: it decides which pages exist, so each address must match real items (no match shows the 404 page). A param it ignores would make the same page under many addresses.';
  // what a URL part can be compared with: one value, not photos, long texts or lists
  const MATCHABLE = ['text', 'number', 'date', 'choice', 'select'];
  const ANY = ''; // the Select's value for Any (no rule)

  const pageId = $derived(pageIdOf(g.file) || '');
  const params = $derived(isTemplate(pageId) ? paramsOf(pageId) : []);
  // (read on its own: the store changes a value in place, so the block stays the same object)
  const source = $derived.by(() => {
    live.version;
    const v = live.get(g.file, `${base}/source`);
    return sourceOf({ source: v }) ? structuredClone(v) : null;
  });
  const mode = $derived(source?.mode ?? 'none');
  const MODES = $derived([
    list ? ['all', 'All'] : ['item', 'Item'],
    ['url', 'From URL'],
    ['none', 'None'],
  ]);
  const schema = $derived.by(() => {
    live.version;
    return source ? schemaFor(live.store, sourceFile(source.from)) : null;
  });
  const itemsOf = (id) => {
    live.version;
    const items = live.get(sourceFile(id), '/items');
    return Array.isArray(items) ? items : [];
  };
  const nameOf = (id, it) => itemName(it, schemaFor(live.store, sourceFile(id)));

  // ---- the main block
  const mainId = $derived.by(() => {
    live.version;
    return live.get(g.file, '/main');
  });
  const isMain = $derived(params.length > 0 && mainId === g.id);
  const problem = $derived(isMain ? mainProblem(live.content, pageId) : null);
  const built = $derived(
    isMain && !problem ? live.routes.filter((r) => r.id === pageId && !r.unbuilt).length : 0,
  );
  const mainHint = $derived.by(() => {
    if (isMain && problem) return { text: problem.message, warn: true };
    if (isMain) {
      const how =
        list || params.length > 1 ? 'A page if at least one item matches' : 'A page per item';
      return { text: `${how} · ${plural(built, 'page')} built`, warn: false };
    }
    return mainId
      ? { text: 'Off: the page’s main block is another one', warn: false }
      : { text: 'Off: no block is the main block, so no pages are built', warn: true };
  });

  // ---- writing it
  const set = (next) =>
    live.store.set(g.file, `${base}/source`, next ?? undefined, {
      source: 'panel',
      structure: true,
    });
  const firstFrom = () =>
    source?.from || sourceIds.find((id) => itemsOf(id).length) || sourceIds[0] || '';
  function pickMode(m) {
    if (m === mode) return;
    const from = firstFrom();
    if (m === 'none') return toNone();
    if (m === 'all') return set({ mode: 'all', from });
    if (m === 'url') return set(urlSource(live.content, from, params));
    // Item: the one it shows now, else the source's first
    const it = shown?.item ?? itemsOf(from).find((i) => typeof i?.id === 'string');
    if (it) set({ mode: 'item', from, id: it.id });
  }
  /**
   * None: the block's own texts. A field that showed the item's value keeps it as its own text
   * (a text: what it showed; anything else: its default), one undo step.
   */
  function toNone() {
    const own = (v) => {
      if (isBinding(v)) {
        const shownValue = resolve(v, { item: shown?.item, def: { type: 'text' } });
        return typeof shownValue === 'string' ? shownValue : undefined;
      }
      if (Array.isArray(v)) return v.map(own);
      if (v && typeof v === 'object')
        return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, own(x)]));
      return v;
    };
    const block = live.get(g.file, base) || {};
    live.store.batch(
      () => {
        set(undefined);
        for (const [k, v] of Object.entries(block))
          if (k !== 'source' && JSON.stringify(v).includes('"bind"'))
            live.store.set(g.file, `${base}/${k}`, own(structuredClone(v)), {
              source: 'panel',
              structure: true,
            });
      },
      { source: 'panel' },
    );
  }
  /** The rule of `param` set to `field` (ANY: no rule), the others kept, in address order. */
  function setRule(param, field) {
    const rules = params
      .map((p) =>
        p === param ? (field === ANY ? null : { param, field }) : ruleOf(source.where, p),
      )
      .filter(Boolean);
    set({ ...source, where: { op: 'and', rules } });
  }
  function setMain(on) {
    live.store.batch(
      () => {
        if (on && mode !== 'url') set(urlSource(live.content, firstFrom(), params));
        live.store.set(g.file, '/main', on ? g.id : undefined, {
          source: 'panel',
          structure: true,
        });
      },
      { source: 'panel' },
    );
  }

  // ---- the param rows
  const fields = $derived([
    SLUG,
    ...(schema?.fields || [])
      .filter((f) => !f.list && MATCHABLE.includes(f.type ?? 'text'))
      .map((f) => f.key)
      .filter((k) => k !== SLUG),
  ]);
  const rows = $derived(
    mode !== 'url'
      ? []
      : params.map((p) => {
          const rule = ruleOf(source.where, p);
          const missing = !!rule && !hasField(schema, rule.field);
          const own = fields.map((f) => ({
            value: f,
            label: f,
            hint: f === p ? 'same name' : f === SLUG ? 'default' : '',
          }));
          if (missing)
            own.push({ value: rule.field, label: rule.field, hint: 'not in this source' });
          return {
            param: p,
            field: rule?.field ?? ANY,
            missing,
            how: !rule
              ? ''
              : rule.field === defaultField(p, schema)
                ? rule.field === p
                  ? 'same name'
                  : 'default'
                : '',
            options: [
              { group: 'Match the field', options: own },
              {
                group: '',
                options: [
                  {
                    value: ANY,
                    label: 'Any',
                    hint: isMain ? '' : 'not filtered',
                    disabled: isMain,
                    note: isMain ? ANY_WHY : '',
                  },
                ],
              },
            ],
          };
        }),
  );
  const missing = $derived(rows.find((r) => r.missing));
  const unused = $derived(rows.filter((r) => r.field === ANY).map((r) => `[${r.param}]`));

  // ---- what it shows
  const showsLine = $derived.by(() => {
    if (!source) return null;
    const n = shown?.items.length ?? 0;
    const first = shown?.item;
    if (!n)
      return {
        text: mode === 'item' ? 'The item is missing from its source' : 'No item matches this page',
        miss: true,
      };
    if (n === 1 && first) return { text: `1 item: ${nameOf(source.from, first)}`, miss: false };
    const extra = unused.length ? ` (${unused.join(', ')} not used)` : '';
    const match = mode === 'all' ? `${n} items` : `${n} items match${extra}`;
    return { text: list ? match : `${match} · the fields show the first`, miss: false };
  });

  // the page head's warning: this block's row of that param, in view and focused
  let el = $state();
  $effect(() => {
    const at = ui.focusParam;
    if (!at || at.block !== g.id || !el) return;
    ui.focusParam = null;
    tick().then(() => {
      const row = at.param && el.querySelector(`[data-param="${CSS.escape(at.param)}"]`);
      const target = row?.querySelector('.sel') || el.querySelector('.seg__btn.is-active');
      (row || el).scrollIntoView({ block: 'center', behavior: 'smooth' });
      target?.focus({ preventScroll: true });
    });
  });
</script>

<div class="bs" bind:this={el}>
  <div class="tf">
    <span class="tf__label">Source</span>
    <div class="seg" role="radiogroup" aria-label="Source">
      {#each MODES as [m, label] (m)}
        {@const off = m === 'url' && !params.length}
        <button
          type="button"
          role="radio"
          aria-checked={mode === m}
          aria-disabled={off || undefined}
          title={off ? NO_PARAMS : undefined}
          class={['seg__btn', mode === m && 'is-active', off && 'is-off']}
          onclick={() => !off && pickMode(m)}>{label}</button
        >
      {/each}
    </div>
  </div>

  {#if mode === 'item'}
    <ItemPicker
      store={live.store}
      value={{ source: source.from, id: source.id }}
      changed={live.changed(g.file, `${base}/source`)}
      {sourceIds}
      {onsource}
      {itemsOf}
      {nameOf}
      onpick={(v) => set(v ? { mode: 'item', from: v.source, id: v.id } : undefined)}
    />
  {:else if source}
    <ItemPicker
      store={live.store}
      mode="source"
      value={source.from}
      changed={live.changed(g.file, `${base}/source/from`)}
      none={null}
      {sourceIds}
      {onsource}
      {itemsOf}
      onpick={(id) => id && set({ ...source, from: id })}
    />
  {/if}

  {#if rows.length}
    <p class="bs__title">Match the address</p>
    <div class="bs__rules">
      {#each rows as r, i (r.param)}
        <div class="bs__rule" data-param={r.param}>
          <span class="bs__and">{i ? 'and' : 'where'}</span>
          <span class="bs__param">[{r.param}]</span>
          <span class="bs__eq">=</span>
          <div class={['bs__field', r.field !== ANY && 'is-param', r.missing && 'is-missing']}>
            <Select
              aria-label="The field [{r.param}] matches"
              value={r.field}
              options={r.options}
              onchange={(v) => setRule(r.param, v)}
            >
              {#snippet selected(o)}
                {o.value === ANY ? 'Any (not filtered)' : o.label}{#if r.missing}<span
                    class="bs__how is-err">· not in this source</span
                  >{:else if r.how}<span class="bs__how">· {r.how}</span>{/if}
              {/snippet}
            </Select>
          </div>
        </div>
      {/each}
    </div>
    {#if missing}
      <p class="bs__note" role="alert">
        <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
        <span
          >[{missing.param}] matches “{missing.field}”, which this source doesn’t have. Pick a
          field, or another source. It saves as it is; {isMain
            ? 'no pages are built'
            : 'no item matches'} until then.</span
        >
      </p>
    {/if}
  {/if}

  {#if showsLine}
    <p class={['bs__shows', showsLine.miss && 'is-miss']}>
      <i
        class={['fa-solid', showsLine.miss ? 'fa-triangle-exclamation' : 'fa-eye']}
        aria-hidden="true"
      ></i>
      <span>{showsLine.text}</span>
    </p>
  {/if}

  {#if params.length}
    <hr class="bs__line" />
    <label class="tf">
      <span class="tf__label">
        <span class="bs__main"><i class="fa-solid fa-star" aria-hidden="true"></i>Main block</span>
        <input
          type="checkbox"
          class="switch"
          role="switch"
          title="The main block decides which pages this page builds"
          checked={isMain}
          onchange={(e) => setMain(e.currentTarget.checked)}
        />
      </span>
    </label>
    <p class={['hint small bs__hint', mainHint.warn && 'is-warn']}>{mainHint.text}</p>
  {/if}
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  // a whole row of the fields grid, its parts 12px apart
  .bs {
    @include stack(var(--space-3));
    grid-column: 1 / -1;

    .tf__label {
      margin-bottom: var(--space-2);
    }
  }

  // a mode that can't be used on this page
  .seg__btn.is-off {
    opacity: var(--o-disabled);
    cursor: not-allowed;
  }

  .bs__title {
    @include muted;
    margin: 0;
    font-size: var(--fs-xs);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .bs__rules {
    @include stack(var(--space-1));
  }

  // [ where | [person] | = | field ▾ ]: 32px
  .bs__rule {
    @include row(var(--space-2));
    height: var(--size-control);
  }

  .bs__and {
    @include muted;
    flex: none;
    width: 40px;
    font-size: var(--fs-xs);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  // the param: the block accent, as in the page head's path
  .bs__param {
    flex: none;
    min-width: 72px;
    color: var(--c-block-accent);
  }

  .bs__eq {
    @include muted;
    flex: none;
  }

  .bs__field {
    flex: 1;
    min-width: 0;
    color: var(--c-text-muted);

    &.is-param {
      color: var(--c-block-accent);
    }

    &.is-missing {
      color: var(--c-error);

      :global(.sel) {
        box-shadow: inset 0 0 0 1px var(--c-error);
      }
    }
  }

  .bs__how {
    @include muted;
    margin-left: var(--space-1);
    font-size: var(--fs-xs);

    &.is-err {
      color: var(--c-error);
    }
  }

  // the error under the rows
  .bs__note {
    @include row(var(--space-2));
    align-items: flex-start;
    margin: 0;
    padding: var(--space-2);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--c-error) 10%, transparent);
    color: var(--c-error);
    font-size: var(--fs-sm);
    line-height: 16px;

    i {
      flex: none;
      line-height: 16px;
      font-size: var(--fs-2xs);
    }
  }

  // what it shows: one muted line; nothing: the notice colour
  .bs__shows {
    @include row(var(--space-2));
    @include muted;
    margin: 0;
    font-size: var(--fs-sm);

    span {
      @include ellipsis;
    }

    i {
      flex: none;
      font-size: var(--fs-2xs);
    }

    &.is-miss {
      color: var(--c-notice);
    }
  }

  .bs__line {
    width: 100%;
    margin: 0;
    border: 0;
    border-top: 1px solid var(--c-line);
  }

  .bs__main {
    @include row(var(--space-2));
    color: var(--c-text);

    i {
      color: var(--c-block-accent);
      font-size: var(--fs-2xs);
    }
  }

  .bs__hint {
    margin: calc(-1 * var(--space-2)) 0 0;

    &.is-warn {
      color: var(--c-notice);
    }
  }
</style>
