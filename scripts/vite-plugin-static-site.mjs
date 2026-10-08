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
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadContent } from './content.mjs';

const RENDER_MODULE = '/src/site/render.js';

const fill = (shell, { head, body }) => shell.replace('<!--ssr-head-->', head).replace('<!--ssr-body-->', body);

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
      server.watcher.on('change', (file) => {
        if (/[\\/](content|src[\\/]site|\.generated)[\\/]/.test(file)) server.ws.send({ type: 'full-reload' });
      });

      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'GET') return next();
        const url = new URL(req.url, 'http://localhost');
        const accept = req.headers.accept || '';
        const looksLikePage = !path.extname(url.pathname) || url.pathname.endsWith('.html');
        if (!looksLikePage || (!accept.includes('text/html') && !accept.includes('*/*'))) return next();
        if (url.pathname.startsWith('/@') || url.pathname.startsWith('/node_modules')) return next();
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
      fs.writeFileSync(path.join(outDir, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${content.site.url}/sitemap.xml\n`);
      fs.rmSync(path.join(outDir, '404'), { recursive: true, force: true });
      config.logger.info(`\x1b[32m✓\x1b[0m prerendered ${routes.length} routes into ${path.relative(root, outDir)}/`);
    },
  };
}
