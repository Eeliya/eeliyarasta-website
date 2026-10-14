/**
 * Screenshot editor UI mocks (sandbox/mocks/<name>.svelte or .html, sandbox/README.md):
 *
 *   npm run mock -- <name> [<name> ...] [--width N] [--out path] [--bare]
 *
 * One name: <MOCK_DIR>/<name>.png (MOCK_DIR: default ../mocks, next to the checkout). Several:
 * stacked with their names in one image (<MOCK_DIR>/<first>+N.png, or --out). It reuses the dev server on MOCK_PORT (5173) or
 * starts one (left running for the next call), drives headless Chrome (CHROME, default
 * /usr/bin/google-chrome) over the DevTools protocol and prints the PNG's path.
 */
import { spawn } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  existsSync,
  openSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const args = process.argv.slice(2);
const names = [];
const opt = { width: 0, out: '', bare: false };
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--width') opt.width = parseInt(args[++i], 10);
  else if (args[i] === '--out') opt.out = args[++i];
  else if (args[i] === '--bare') opt.bare = true;
  else names.push(args[i]);
}
if (!names.length) {
  console.error('usage: npm run mock -- <name> [<name> ...] [--width N] [--out path] [--bare]');
  process.exit(1);
}
for (const n of names)
  if (!['svelte', 'html'].some((x) => existsSync(`sandbox/mocks/${n}.${x}`))) {
    console.error(`No mock sandbox/mocks/${n}.svelte (or .html)`);
    process.exit(1);
  }

const port = Number(process.env.MOCK_PORT || 5173);
const base = `http://localhost:${port}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const up = () =>
  fetch(`${base}/edit/sandbox/`)
    .then((r) => r.ok)
    .catch(() => false);

// the dev server: reuse it, or start one in the background (it stays up for the next mock)
if (!(await up())) {
  const log = openSync(join(tmpdir(), `mock-vite-${port}.log`), 'a');
  spawn('npx', ['vite', '--port', String(port), '--strictPort'], {
    detached: true,
    stdio: ['ignore', log, log],
  }).unref();
  for (let i = 0; i < 100 && !(await up()); i++) await sleep(200);
  if (!(await up())) throw new Error(`The dev server didn't start on port ${port}`);
}

// headless Chrome with the DevTools protocol on a free port
const profile = mkdtempSync(join(tmpdir(), 'mock-chrome-'));
const chrome = spawn(
  process.env.CHROME || '/usr/bin/google-chrome',
  [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--hide-scrollbars',
    '--force-device-scale-factor=2',
    'about:blank',
  ],
  { stdio: 'ignore' },
);
let devtools = '';
for (let i = 0; i < 100 && !devtools; i++) {
  await sleep(100);
  try {
    devtools = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0];
  } catch {
    /* not yet */
  }
}
const quit = () => {
  chrome.kill();
  setTimeout(() => rmSync(profile, { recursive: true, force: true }), 300);
};

try {
  const [target] = (await (await fetch(`http://127.0.0.1:${devtools}/json/list`)).json()).filter(
    (t) => t.type === 'page',
  );
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)));
  let id = 0;
  const waiting = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (waiting.has(m.id)) {
      const { ok, fail } = waiting.get(m.id);
      waiting.delete(m.id);
      if (m.error) fail(new Error(m.error.message));
      else ok(m.result);
    }
  };
  const send = (method, params = {}) =>
    new Promise((ok, fail) => {
      waiting.set(++id, { ok, fail });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) =>
    (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result
      .value;

  await send('Emulation.setDeviceMetricsOverride', {
    width: 1200,
    height: 1600,
    deviceScaleFactor: 2,
    mobile: false,
  });
  const q = new URLSearchParams({ mock: names.join(',') });
  if (opt.width) q.set('width', String(opt.width));
  if (opt.bare) q.set('bare', '1');
  await send('Page.navigate', { url: `${base}/edit/sandbox/?${q}` });
  for (let i = 0; i < 300 && !(await evaluate('window.__mockReady === true')); i++) await sleep(50);
  // everything drawn, also what reaches out of the panel (an open menu)
  const box = await evaluate(`(() => {
    const root = document.getElementById('sandbox');
    const r = root.getBoundingClientRect();
    let right = r.right, bottom = r.bottom;
    for (const el of root.querySelectorAll('*')) {
      const b = el.getBoundingClientRect();
      if (b.width && b.height) { right = Math.max(right, b.right); bottom = Math.max(bottom, b.bottom); }
    }
    return { x: r.left, y: r.top, width: right - r.left + 16, height: bottom - r.top + 16 };
  })()`);
  const { data } = await send('Page.captureScreenshot', {
    format: 'png',
    clip: { ...box, scale: 1 },
    captureBeyondViewport: true,
  });
  const out = resolve(
    opt.out ||
      `${process.env.MOCK_DIR || resolve('..', 'mocks')}/${names[0]}${names.length > 1 ? `+${names.length - 1}` : ''}.png`,
  );
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, Buffer.from(data, 'base64'));
  console.log(out);
  ws.close();
} finally {
  quit();
}
