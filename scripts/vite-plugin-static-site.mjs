/**
 * vite-plugin-static-site: the whole "static site builder" in one small plugin.
 *
 *  dev   → every HTML request is rendered on the fly from content/<folder>/*.json with the
 *          templates in src/site (via Vite's SSR loader, so edits hot-reload).
 *  build → after Vite bundles the client (index.html → dist/index.html with hashed
 *          JS/CSS), every route is rendered into that shell and written to
 *          dist/<route>/index.html, plus 404.html, sitemap.xml and robots.txt.
 *
 * index.html is the shell; it contains two markers: <!--ssr-head--> and <!--ssr-body-->.
 *
 * Visual editor (edit/index.html → src/editor) is DEV ONLY:
 *  dev   → /edit/ is served by Vite, and /__editor/* (scripts/editor-server.mjs, localhost
 *          only) loads, saves and publishes the content JSON files and uploads photos to
 *          Cloudflare R2 with the R2_* keys from .env.local (read here, never sent to a page).
 *
 * Dev reloads: a change in content/, .generated/ or src/site/ sends the custom HMR event
 * "site:changed" { files, content, external } instead of Vite's full reload, which every
 * page would obey, the editor at /edit/ included. The editor reloads only its preview
 * (src/editor/main.js); a plain site tab reloads itself (src/client/main.js). external is
 * false for the editor's own saves. Code changes keep normal HMR.
 *  build → only index.html is bundled; no editor page, code or endpoints are emitted.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadEnv } from 'vite';
import { loadContent } from './content.mjs';
import { editorMiddleware } from './editor-server.mjs';
import { pageFile } from '../src/site/files.js';

const RENDER_MODULE = '/src/site/render.js';

const fill = (shell, { head, body }) =>
  shell.replace('<!--ssr-head-->', head).replace('<!--ssr-body-->', body);

/** content/ and .generated/ files are data: they re-render pages, never hot-update modules. */
const DATA = /^(content|\.generated)\//;

export default function staticSite() {
  let config;
  // Until then, content changes come from the editor's own Save (not "external").
  let editorWriteUntil = 0;
  return {
    name: 'static-site',
    configResolved(c) {
      config = c;
    },

    configureServer(server) {
      const root = config.root;
      // Content and media manifest changes re-render pages (see handleHotUpdate).
      server.watcher.add([path.join(root, 'content'), path.join(root, '.generated')]);

      // Editor endpoints (dev only, localhost only).
      server.middlewares.use(
        '/__editor',
        editorMiddleware({
          root,
          logger: config.logger,
          // R2_* only (Node side): Vite exposes nothing but VITE_* to client code
          env: loadEnv(config.mode, config.envDir || root, 'R2_'),
          onWrite: () => (editorWriteUntil = Date.now() + 2000),
        }),
      );

      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'GET') return next();
        const url = new URL(req.url, 'http://localhost');
        const accept = req.headers.accept || '';
        const looksLikePage = !path.extname(url.pathname) || url.pathname.endsWith('.html');
        if (!looksLikePage || (!accept.includes('text/html') && !accept.includes('*/*')))
          return next();
        if (url.pathname.startsWith('/@') || url.pathname.startsWith('/node_modules'))
          return next();
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
          const html = await server.transformIndexHtml(
            req.url,
            fill(shell, renderRoute(route, content)),
          );
          res.statusCode = status;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(html);
        } catch (err) {
          server.ssrFixStacktrace?.(err);
          next(err);
        }
      });
    },

    /** Content and templates changed: tell the pages (see the top of this file). */
    handleHotUpdate({ file, server }) {
      const rel = path.relative(config.root, file).split(path.sep).join('/');
      const content = DATA.test(rel);
      if (!content && !rel.startsWith('src/site/')) return;
      const external = Date.now() >= editorWriteUntil;
      server.ws.send({
        type: 'custom',
        event: 'site:changed',
        data: { files: [rel], content, external },
      });
      // Client code imports animations.json: without this, Vite would full-reload every page.
      // src/site modules keep Vite's own handling (the editor imports some of them).
      if (content) return [];
    },

    async closeBundle() {
      if (config.command !== 'build') return;
      const root = config.root;
      const outDir = path.resolve(root, config.build.outDir);
      const shellFile = path.join(outDir, 'index.html');
      if (!fs.existsSync(shellFile)) return;
      const shell = fs.readFileSync(shellFile, 'utf8');
      const { buildRoutes, renderRoute } = await import(
        pathToFileURL(path.join(root, RENDER_MODULE)).href + `?t=${Date.now()}`
      );
      const content = loadContent(root);
      const { routes, warnings } = buildRoutes(content);
      for (const w of warnings) config.logger.warn(`\x1b[33m[routes]\x1b[0m ${w}`);

      for (const route of routes) {
        const rel = route.out || path.join(route.path, 'index.html');
        const file = path.join(outDir, rel);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, fill(shell, renderRoute(route, content)));
      }
      const urls = routes
        .filter((r) => !r.noindex)
        .map((r) => `  <url><loc>${content.site.url}${r.path}</loc></url>`);
      fs.writeFileSync(
        path.join(outDir, 'sitemap.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
      );
      fs.writeFileSync(
        path.join(outDir, 'robots.txt'),
        `User-agent: *\nAllow: /\nSitemap: ${content.site.url}/sitemap.xml\n`,
      );

      // The editor is dev-only: make sure nothing of it ends up in the build.
      fs.rmSync(path.join(outDir, 'edit'), { recursive: true, force: true });
      fs.rmSync(path.join(outDir, '404'), { recursive: true, force: true });
      config.logger.info(
        `\x1b[32m✓\x1b[0m prerendered ${routes.length} routes into ${path.relative(root, outDir)}/\n` +
          routes.map((r) => `  ${r.path.padEnd(28)} ${r.template || pageFile(r.id)}`).join('\n'),
      );
    },
  };
}
