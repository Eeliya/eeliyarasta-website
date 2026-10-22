/**
 * A site's own widgets: the widget modules site.config.mjs lists in `widgets` (paths from the
 * site's root, a folder or its index.js), after the built-ins (src/site/widgets/index.js has
 * the format). Node only. A widget module's folder:
 *
 *   index.js     default export: its definition (type, label, icon, fields, defaults, render, ...)
 *   style.scss   optional: its look, bundled into the site's stylesheet (after the theme's)
 *   client.js    optional: default export (el) => cleanup?, run on every .wgt--<type> of a page
 *
 * The Node side (build, dev server, editor endpoints, tests) registers them with
 * registerSiteWidgets; the browser gets them from two virtual modules the Vite plugin serves:
 * virtual:site-widgets (the definitions: the editor) and virtual:site-widgets/client (styles
 * and client modules: the public site).
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadSiteConfig } from './site-config.mjs';
import { registerWidgets } from '../src/site/widgets/index.js';

/** The site's widget modules: [{ spec, dir, index, style, client }] (style, client: or null). */
export function widgetModulesOf(root) {
  const site = loadSiteConfig(root);
  const list = site.config.widgets || [];
  if (!Array.isArray(list)) throw new Error('site.config.mjs: "widgets" must be a list of paths');
  return list.map((spec) => {
    const at = path.resolve(site.root, String(spec));
    const isFile = /\.m?js$/.test(at);
    const dir = isFile ? path.dirname(at) : at;
    const index = isFile ? at : path.join(dir, 'index.js');
    if (!fs.existsSync(index))
      throw new Error(
        `site.config.mjs widgets: "${spec}" has no ${path.relative(site.root, index)}`,
      );
    const opt = (name) => (fs.existsSync(path.join(dir, name)) ? path.join(dir, name) : null);
    return { spec, dir, index, style: opt('style.scss'), client: opt('client.js') };
  });
}

/** The site's widget definitions, imported (load: how; Node's import by default). */
export async function loadSiteWidgets(root, load = (file) => import(pathToFileURL(file).href)) {
  const defs = [];
  for (const m of widgetModulesOf(root)) {
    const mod = await load(m.index);
    defs.push(mod.default);
  }
  return defs;
}

/** Load the site's widgets and add them to the registry (register: registerWidgets). */
export async function registerSiteWidgets(root, { load, register = registerWidgets } = {}) {
  const defs = await loadSiteWidgets(root, load);
  register(defs, `${path.basename(loadSiteConfig(root).root)}/site.config.mjs widgets`);
  return defs;
}

const id = (file) => JSON.stringify(file.split(path.sep).join('/'));

/** virtual:site-widgets: the definitions, for the editor's browser code. */
export function widgetsModule(root) {
  const mods = widgetModulesOf(root);
  return (
    mods.map((m, i) => `import w${i} from ${id(m.index)};\n`).join('') +
    `export default [${mods.map((_, i) => `w${i}`).join(', ')}];\n`
  );
}

/** virtual:site-widgets/client: the widgets' styles and client modules, for the public site. */
export async function widgetClientsModule(root, load) {
  const mods = await typedWidgetModulesOf(root, load);
  const styles = mods.filter((m) => m.style).map((m) => `import ${id(m.style)};\n`);
  const clients = mods.filter((m) => m.client);
  return (
    styles.join('') +
    clients.map((m, i) => `import c${i} from ${id(m.client)};\n`).join('') +
    `export default [${clients.map((m, i) => `{ type: ${JSON.stringify(m.type)}, init: c${i} }`).join(', ')}];\n`
  );
}

/** widgetModulesOf with each module's type (its definition's), for the client module. */
export async function typedWidgetModulesOf(root, load) {
  const mods = widgetModulesOf(root);
  const defs = await loadSiteWidgets(root, load);
  return mods.map((m, i) => ({ ...m, type: defs[i]?.type }));
}
