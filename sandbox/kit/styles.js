/**
 * The real components' own (scoped) styles, for kit markup that mirrors theirs: a component's
 * <style lang="scss"> is read from src (?raw), its :global(…) unwrapped, nested under a scope
 * class and compiled in the browser (sass), once. So the kit's toolbar, footer and block rows
 * follow App.svelte and SectionsList.svelte as they change; nothing is copied.
 *
 *   APP   '.kit-app'   App.svelte: .ed-panel, .ed-head, .ed-row, .ed-tools, .ed-modes, .ed-foot…
 *   LIST  '.kit-list'  SectionsList.svelte: .blocks, .block, .block__*, .add, .confirm…
 */
import * as sass from 'sass';
import appSrc from '../../src/editor/svelte/App.svelte?raw';
import listSrc from '../../src/editor/svelte/SectionsList.svelte?raw';

const styleOf = (src) => src.match(/<style lang="scss">([\s\S]*?)<\/style>/)?.[1] || '';
// :global(x) → x (balanced parens: one level of nesting is enough for these files)
const unglobal = (scss) => scss.replace(/:global\(((?:[^()]|\([^()]*\))*)\)/g, '$1');

function inject(scope, src) {
  const css = sass.compileString(`${scope} { ${unglobal(styleOf(src))} }`).css;
  const el = document.createElement('style');
  el.dataset.kit = scope;
  el.textContent = css;
  document.head.append(el);
}

inject('.kit-app', appSrc);
inject('.kit-list', listSrc);

export const APP = 'kit-app';
export const LIST = 'kit-list';
