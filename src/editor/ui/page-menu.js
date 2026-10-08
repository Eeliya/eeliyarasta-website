/**
 * Custom glass page/component picker for the editor.
 * Pages navigate the preview; Menu and Footer are components that keep the
 * current page visible and switch the Content panel to their fields.
 */
import { h, clear } from './dom.js';

export function createPageMenu({ onChange }) {
  let open = false;
  let value = { kind: 'page', path: '/', title: 'Home' };
  let items = [];

  const label = h('span', { class: 'pm__label' }, 'Home');
  const kind = h('span', { class: 'pm__kind' }, 'Page');
  const list = h('ul', { class: 'pm__list', role: 'listbox', id: 'ed-page-list', hidden: true });
  const btn = h(
    'button',
    {
      type: 'button',
      class: 'pm__btn',
      'aria-haspopup': 'listbox',
      'aria-expanded': 'false',
      'aria-controls': 'ed-page-list',
      onclick: (e) => {
        e.stopPropagation();
        setOpen(!open);
      },
    },
    kind,
    label,
    h('i', { class: 'fa-solid fa-chevron-down pm__caret', 'aria-hidden': 'true' }),
  );

  const root = h('div', { class: 'pm', dataset: { open: 'false' } }, btn, list);

  function setOpen(next) {
    open = next;
    root.dataset.open = String(open);
    btn.setAttribute('aria-expanded', String(open));
    list.hidden = !open;
    if (open) {
      const active =
        list.querySelector('[aria-selected="true"]') || list.querySelector('[role="option"]');
      active?.focus();
    }
  }

  function select(item, { silent = false } = {}) {
    value = item;
    label.textContent = item.title;
    kind.textContent = item.kind === 'component' ? 'Component' : 'Page';
    kind.dataset.kind = item.kind;
    list.querySelectorAll('[role="option"]').forEach((opt) => {
      const match = opt.dataset.key === itemKey(item);
      opt.setAttribute('aria-selected', String(match));
      opt.classList.toggle('is-active', match);
    });
    setOpen(false);
    if (!silent) onChange?.(item);
  }

  function itemKey(item) {
    return item.kind === 'component' ? `component:${item.id}` : `page:${item.path}`;
  }

  function option(item) {
    const key = itemKey(item);
    const opt = h(
      'li',
      {
        role: 'option',
        tabindex: '-1',
        class: 'pm__opt',
        dataset: { key, kind: item.kind },
        'aria-selected': 'false',
        onclick: (e) => {
          e.stopPropagation();
          select(item);
        },
        onkeydown: (e) => onOptKey(e, item),
      },
      h(
        'span',
        { class: ['pm__badge', item.kind === 'component' ? 'is-component' : 'is-page'] },
        item.kind === 'component' ? 'Component' : 'Page',
      ),
      h('span', { class: 'pm__opt-title' }, item.title),
      item.path ? h('span', { class: 'pm__opt-path' }, item.path) : null,
    );
    return opt;
  }

  function onOptKey(e, item) {
    const opts = [...list.querySelectorAll('[role="option"]')];
    const i = opts.indexOf(e.currentTarget);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      opts[(i + 1) % opts.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      opts[(i - 1 + opts.length) % opts.length]?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      select(item);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      btn.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      opts[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      opts.at(-1)?.focus();
    }
  }

  function setItems(next, { path } = {}) {
    items = next;
    clear(list);
    const pages = items.filter((i) => i.kind === 'page');
    const components = items.filter((i) => i.kind === 'component');
    if (pages.length) {
      list.append(h('li', { class: 'pm__group', role: 'presentation' }, 'Pages'));
      pages.forEach((item) => list.append(option(item)));
    }
    if (components.length) {
      list.append(h('li', { class: 'pm__group', role: 'presentation' }, 'Components'));
      components.forEach((item) => list.append(option(item)));
    }
    const match = path
      ? items.find((i) => i.kind === 'page' && i.path === path)
      : items.find((i) => itemKey(i) === itemKey(value));
    if (match) select(match, { silent: true });
    else if (items[0]) select(items[0], { silent: true });
  }

  document.addEventListener('click', (e) => {
    if (open && !root.contains(e.target)) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) {
      setOpen(false);
      btn.focus();
    }
  });

  return {
    el: root,
    get value() {
      return value;
    },
    setItems,
    setValue(item, { silent = true } = {}) {
      const match = items.find((i) => itemKey(i) === itemKey(item));
      if (match) select(match, { silent });
    },
    close: () => setOpen(false),
  };
}
