/**
 * Editor UI sandbox (dev only: /edit/sandbox/, never built). Renders mocks from
 * sandbox/mocks/<name>.svelte (or .html) on the editor's panel, with the editor's real styles,
 * tokens, fonts and icons, so they can import its real components.
 *
 *   ?mock=name          one mock      ?mock=a,b,c   several, stacked with their names
 *   ?width=400          the panel's width (default: the editor's, --panel-w)
 *   ?bare=1             no panel around it (the editor's page background only)
 *
 * When everything is drawn (fonts too) window.__mockReady is true; scripts/mock.mjs waits for
 * it and screenshots #sandbox.
 */
import '../src/editor/styles/editor.scss';
import '@fortawesome/fontawesome-free/css/fontawesome.css';
import '@fortawesome/fontawesome-free/css/solid.css';
import './sandbox.scss';
import { mount } from 'svelte';

const svelteMocks = import.meta.glob('./mocks/*.svelte');
const htmlMocks = import.meta.glob('./mocks/*.html', { query: '?raw', import: 'default' });
const nameOf = (path) => path.replace(/^.*\/|\.(svelte|html)$/g, '');
const all = [...Object.keys(svelteMocks), ...Object.keys(htmlMocks)].map(nameOf).sort();

const params = new URLSearchParams(location.search);
const names = (params.get('mock') || '').split(',').filter(Boolean);
const root = document.getElementById('sandbox');
if (params.get('width'))
  root.style.setProperty('--mock-w', `${parseInt(params.get('width'), 10)}px`);
if (params.get('bare')) root.classList.add('is-bare');

async function render(name, into) {
  const svelte = svelteMocks[`./mocks/${name}.svelte`];
  const html = htmlMocks[`./mocks/${name}.html`];
  if (svelte) mount((await svelte()).default, { target: into });
  else if (html) into.innerHTML = await html();
  else into.innerHTML = `<p class="hint">No mock "${name}".</p>`;
}

async function main() {
  if (!names.length) {
    root.innerHTML = `<div class="sb-panel"><h3 class="modal__title">Mocks</h3>${all
      .map((n) => `<p><a href="?mock=${n}">${n}</a></p>`)
      .join('')}</div>`;
  }
  for (const name of names) {
    const item = document.createElement('section');
    item.className = 'sb-item';
    if (names.length > 1) {
      const label = document.createElement('p');
      label.className = 'sb-label';
      label.textContent = name;
      item.append(label);
    }
    const panel = document.createElement('div');
    panel.className = 'sb-panel';
    item.append(panel);
    root.append(item);
    await render(name, panel);
  }
  await document.fonts.ready;
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  window.__mockReady = true;
}

main().catch((err) => {
  root.textContent = String(err?.stack || err);
  window.__mockReady = true;
});
