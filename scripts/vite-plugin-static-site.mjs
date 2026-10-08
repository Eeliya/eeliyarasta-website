/**
 * vite-plugin-static-site: the whole "static site builder" in one small plugin.
 *
 *  dev   → every HTML request is rendered on the fly from content/*.json with the
 *          templates in src/site (via Vite's SSR loader, so edits hot-reload).
 *  build → after Vite bundles the client (index.html → dist/index.html with hashed
 *          JS/CSS), every route is rendered into that shell and written to
 *          dist/<route>/index.html, plus 404.html, sitemap.xml and robots.txt.
 *
 * index.html is the shell; it contains two markers: <!--ssr-head--> and <!--ssr-body-->.
 *
 * Visual editor support (edit/index.html, src/editor):
 *  dev   → GET /__editor/content returns all content files; POST /__editor/save writes
 *          them back to content/*.json (same-origin JSON requests, whitelisted names).
 *  build → a snapshot of the content is copied to dist/edit/content/ so the deployed
 *          editor can start without GitHub; /edit/ is excluded in robots.txt.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadContent } from './content.mjs';
import { formatJSON } from '../src/editor/lib/json-format.js';
import editorConfig from '../src/editor/config.js';

const RENDER_MODULE = '/src/site/render.js';

const fill = (shell, { head, body }) => shell.replace('<!--ssr-head-->', head).replace('<!--ssr-body-->', body);
const EDITABLE = new Set(editorConfig.files);

const readContentFiles = (root) =>
  Object.fromEntries([...EDITABLE].map((f) => [f, JSON.parse(fs.readFileSync(path.join(root, 'content', f), 'utf8'))]));

function readBody(req, limit = 5 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) reject(new Error('Body too large'));
      else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const sendJSON = (res, status, data) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
};

export default function staticSite() {
  let config;
  return {
    name: 'static-site',
    configResolved(c) {
      config = c;
    },

    configureServer(server) {
      const root = config.root;
      // Full reload when content or templates change (they are not part of the client graph).
      server.watcher.add([path.join(root, 'content'), path.join(root, '.generated')]);
      // Saves from the editor would otherwise reload the editor itself.
      let quietUntil = 0;
      server.watcher.on('change', (file) => {
        if (Date.now() < quietUntil && /[\\/]content[\\/]/.test(file)) return;
        if (/[\\/](content|src[\\/]site|\.generated)[\\/]/.test(file)) server.ws.send({ type: 'full-reload' });
      });

      // Editor endpoints (dev only).
      server.middlewares.use('/__editor', async (req, res) => {
        try {
          const origin = req.headers.origin;
          if (origin && new URL(origin).host !== req.headers.host) return sendJSON(res, 403, { error: 'Cross-origin request refused' });
          if (req.method === 'GET' && (req.url === '/content' || req.url.startsWith('/content?'))) {
            return sendJSON(res, 200, { mode: 'dev', files: readContentFiles(root) });
          }
          if (req.method === 'POST' && req.url === '/save') {
            if (!(req.headers['content-type'] || '').includes('application/json')) return sendJSON(res, 415, { error: 'JSON only' });
            const { files } = JSON.parse(await readBody(req));
            const names = Object.keys(files || {});
            const bad = names.filter((n) => !EDITABLE.has(n) || files[n] === null || typeof files[n] !== 'object');
            if (!names.length || bad.length) return sendJSON(res, 400, { error: `Not writable: ${bad.join(', ') || '(nothing)'}` });
            quietUntil = Date.now() + 2000;
            for (const n of names) fs.writeFileSync(path.join(root, 'content', n), formatJSON(files[n]));
            config.logger.info(`\x1b[32m✓\x1b[0m editor saved ${names.map((n) => 'content/' + n).join(', ')}`, { timestamp: true });
            return sendJSON(res, 200, { ok: true, written: names });
          }
          sendJSON(res, 404, { error: 'Unknown editor endpoint' });
        } catch (err) {
          sendJSON(res, 500, { error: err.message });
        }
      });

      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'GET') return next();
        const url = new URL(req.url, 'http://localhost');
        const accept = req.headers.accept || '';
        const looksLikePage = !path.extname(url.pathname) || url.pathname.endsWith('.html');
        if (!looksLikePage || (!accept.includes('text/html') && !accept.includes('*/*'))) return next();
        if (url.pathname.startsWith('/@') || url.pathname.startsWith('/node_modules')) return next();
        if (url.pathname === '/edit') {
          res.writeHead(302, { Location: '/edit/' + url.search });
          return res.end();
        }
        if (url.pathname.startsWith('/edit/')) return next(); // editor app (edit/index.html)
        try {
          const { getRoutes, renderRoute } = await server.ssrLoadModule(RENDER_MODULE);
          const content = loadContent(root);
          const routes = getRoutes(content);
          let pathname = url.pathname.replace(/index\.html$/, '');
          if (!pathname.endsWith('/')) pathname += '/';
          let route = routes.find((r) => r.path === pathname);
          const status = route ? 200 : 404;
          route ||= routes.find((r) => r.page === 'notFound');
          const shell = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
          const html = await server.transformIndexHtml(req.url, fill(shell, renderRoute(route, content)));
          res.statusCode = status;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(html);
        } catch (err) {
          server.ssrFixStacktrace?.(err);
          next(err);
        }
      });
    },

    async closeBundle() {
      if (config.command !== 'build') return;
      const root = config.root;
      const outDir = path.resolve(root, config.build.outDir);
      const shellFile = path.join(outDir, 'index.html');
      if (!fs.existsSync(shellFile)) return;
      const shell = fs.readFileSync(shellFile, 'utf8');
      const { getRoutes, renderRoute } = await import(pathToFileURL(path.join(root, RENDER_MODULE)).href + `?t=${Date.now()}`);
      const content = loadContent(root);
      const routes = getRoutes(content);

      for (const route of routes) {
        const rel = route.out || path.join(route.path, 'index.html');
        const file = path.join(outDir, rel);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, fill(shell, renderRoute(route, content)));
      }
      const urls = routes.filter((r) => !r.noindex).map((r) => `  <url><loc>${content.site.url}${r.path}</loc></url>`);
      fs.writeFileSync(path.join(outDir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
      fs.writeFileSync(path.join(outDir, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /edit/\nSitemap: ${content.site.url}/sitemap.xml\n`);

      // Content snapshot for the deployed editor (used until it is connected to GitHub).
      const snapDir = path.join(outDir, 'edit', 'content');
      fs.mkdirSync(snapDir, { recursive: true });
      const files = readContentFiles(root);
      for (const [name, data] of Object.entries(files)) fs.writeFileSync(path.join(snapDir, name), formatJSON(data));
      fs.writeFileSync(path.join(snapDir, 'index.json'), JSON.stringify({ files: Object.keys(files) }) + '\n');
      fs.rmSync(path.join(outDir, '404'), { recursive: true, force: true });
      config.logger.info(`\x1b[32m✓\x1b[0m prerendered ${routes.length} routes into ${path.relative(root, outDir)}/`);
    },
  };
}
