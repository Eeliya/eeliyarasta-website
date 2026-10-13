<!--
  Tabs: a row of uppercase labels over a 1px line its full width; the picked one white with a
  2px accent underline, the others dim. Only the color and the underline (a shadow) change, so
  picking one moves nothing. The line runs to the container's edges: put it where it should
  span (BlockInspector's card has no side padding around it). A tab's text starts 12px in.
    tabs    [[value, label]]
    value   the picked one
    onpick  (value) => ...
    label   the group's aria-label
    role    'tablist' (they switch a panel; role=tab, aria-selected) or 'group' (a view filter;
            aria-pressed)
    class   extra class on the row
    id      the tabs' ids are "<id>-<value>" (tablist: the panel's aria-labelledby)
    panel   the id of the panel they switch (tablist: aria-controls)
  A tablist is one Tab stop: ←/→ (Home/End) move to the next tab and pick it.
  Used by the block card (Content / Layout / Motion), the Motion panel (Elements / Animations)
  and the Media window's filter (All / R2 / Local). Not the mode bar (.seg--pill).
-->
<script>
  let {
    tabs,
    value,
    onpick,
    label,
    role = 'tablist',
    class: cls = '',
    id: idProp = '',
    panel = undefined,
  } = $props();
  const uid = $props.id();
  const id = $derived(idProp || uid);
  const isTab = $derived(role === 'tablist');

  function onkeydown(e) {
    if (!isTab) return;
    const at = tabs.findIndex(([v]) => v === value);
    const n = tabs.length;
    const to = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: n - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    const [v] = tabs[(to + n) % n];
    onpick(v);
    e.currentTarget.querySelector(`#${CSS.escape(`${id}-${v}`)}`)?.focus();
  }
</script>

<div class={['tabs', cls]} {role} aria-label={label} {onkeydown}>
  {#each tabs as [v, text] (v)}
    <button
      type="button"
      id="{id}-{v}"
      role={isTab ? 'tab' : undefined}
      aria-selected={isTab ? value === v : undefined}
      aria-controls={isTab ? panel : undefined}
      tabindex={isTab && value !== v ? -1 : undefined}
      aria-pressed={isTab ? undefined : value === v}
      class={['tabs__btn', value === v && 'is-active']}
      onclick={() => onpick(v)}>{text}</button
    >
  {/each}
</div>

<style lang="scss">
  .tabs {
    display: flex;
    box-shadow: inset 0 -1px 0 var(--c-line);
  }

  .tabs__btn {
    height: 32px;
    padding: 0 var(--space-3);
    border: 0;
    background: none;
    cursor: pointer;
    font-size: var(--fs-sm);
    letter-spacing: 0.06em;
    line-height: 16px;
    text-transform: uppercase;
    white-space: nowrap;
    color: var(--c-text-muted);
    transition:
      color 0.2s,
      box-shadow 0.2s;

    &:hover {
      color: var(--c-text);
    }

    &:focus-visible {
      outline: none;
      color: var(--c-text);
      box-shadow: inset 0 0 0 1px var(--c-accent);
    }

    &.is-active {
      color: var(--c-text-strong);
      box-shadow: inset 0 -2px 0 var(--c-accent);
    }
  }
</style>
