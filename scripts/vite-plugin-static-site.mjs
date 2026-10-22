/**
 * vite-plugin-static-site: the whole "static site builder" in one small plugin.
 *
 *  dev   → every HTML request is rendered on the fly from content/<folder>/*.json with the
 *          templates in src/site (via Vite's SSR loader, so edits hot-reload).
 *  build → after Vite bundles the client (index.html → dist/index.html with hashed
 *          JS/CSS), every route is rendered into that shell and written to
 *          dist/<route>/index.html, plus 404.html, sitemap.xml, robots.txt and _redirects
 *          (content/en/settings/redirects.json, src/site/redirects.js).
 *
 * index.html is the shell; it contains two markers: <!--ssr-head--> and <!--ssr-body-->.
 *
 * Visual editor (src/editor/index.html → src/editor) is DEV ONLY:
 *  dev   → any page with ?edit (/?edit, /about/?edit&tab=motion: src/editor/lib/editor-url.js)
 *          gets the editor app instead (its preview iframe, ?draft=…, always gets the site; the
 *          old /edit/?path=… redirects there, /edit/sandbox/ to /sandbox/), and /__editor/*
 *          (scripts/editor-server.mjs, localhost only) loads, saves and publishes the content JSON files and uploads photos to
 *          Cloudflare R2 with the R2_* keys from .env.local (read here, never sent to a page).
 *
 * Dev reloads: a change in content/, .generated/ or src/site/ sends the custom HMR event
 * "site:changed" { files, content, external } instead of Vite's full reload, which every
 * page would obey, the editor (?edit) included. The editor reloads only its preview
 * (src/editor/main.js); a plain site tab reloads itself (src/client/main.js). external is
 * false for the editor's own saves. Code changes keep normal HMR.
 *  build → only index.html is bundled; no editor page, code or endpoints are emitted (?edit on
 *          the built site is an ignored param).
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadEnv } from 'vite';
import { loadContent } from './content.mjs';
import { DRAFT_PARAM, draftsFor, editorMiddleware } from './editor-server.mjs';
import { contactMiddleware } from './contact-dev.mjs';
import { pageFile } from '../src/site/files.js';
import { EDITOR_HTML, legacyRedirect, wantsEditor } from '../src/editor/lib/editor-url.js';
import { checkSources } from '../src/site/schemas.js';
import { FOLDERS } from '../src/site/files.js';
import { loadSiteConfig } from './site-config.mjs';

const RENDER_MODULE = '/src/site/render.js';

const attr = (s) => String(s).replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`);
const setLang = (shell, lang) =>
  shell.replace(
    /<html lang="[^"]*"/,
    `<html lang="${String(lang || 'en').replace(/[^\w-]/g, '')}"`,
  );
/** The shell's theme-color meta: the site's (settings), else the shell's own. */
const setThemeColor = (shell, color) =>
  color
    ? shell.replace(
        /(<meta name="theme-color" content=")[^"]*(")/,
        (m, a, b) => `${a}${attr(color)}${b}`,
      )
    : shell;

/** The editor's page: its title names the site (site.json name), lang from site.json. */
export const editorShell = (shell, site = {}) =>
  setLang(shell, site.lang).replace(
    /<title>[^<]*<\/title>/,
    `<title>${site.name ? `Editor · ${attr(site.name)}` : 'Editor'}</title>`,
  );

const fill = (shell, { head, body, lang, themeColor }) =>
  setThemeColor(setLang(shell, lang), themeColor)
    .replace('<!--ssr-head-->', head)
    .replace('<!--ssr-body-->', body);

/** The editor's settings, for its browser code: `import editorConfig from 'virtual:editor-config'`. */
export const EDITOR_CONFIG = 'virtual:editor-config';
/**
 * Client code imports the content folder's files through this alias (site.config.mjs contentDir):
 * `import config from '@site-content/settings/animations.json'`.
 */
export const CONTENT_ALIAS = '@site-content';

/** The editor config module's source: the content folder, the editable folders, the media URL. */
export const editorConfigModule = (site) =>
  `export default ${JSON.stringify({
    contentDir: site.contentRel,
    folders: FOLDERS,
    mediaUrl: site.mediaUrl,
    repo: site.config.repo,
  })};\n`;

const posixRel = (root, p) => path.relative(root, p).split(path.sep).join('/');

export default function staticSite() {
  let config;
  // Until then, content changes come from the editor's own Save (not "external").
  let editorWriteUntil = 0;
  return {
    name: 'static-site',
    config(c) {
      const site = loadSiteConfig(c.root || process.cwd());
      return {
        resolve: { alias: { [CONTENT_ALIAS]: site.contentDir } },
        // the content folder's name, for client messages ("content/en/settings/animations.json")
        define: { __SITE_CONTENT_DIR__: JSON.stringify(site.contentRel) },
      };
    },
    configResolved(c) {
      config = c;
    },
    resolveId(id) {
      if (id === EDITOR_CONFIG) return `\0${EDITOR_CONFIG}`;
    },
    load(id) {
      if (id === `\0${EDITOR_CONFIG}`) return editorConfigModule(loadSiteConfig(config.root));
    },

    configureServer(server) {
      const root = config.root;
      // The editor's unsaved edits per editor session (POST /__editor/draft): only its preview's
      // pages (?draft=<session>) render from them, every other request from the saved files
      const drafts = {};
      // Content and media manifest changes re-render pages (see handleHotUpdate).
      const site = loadSiteConfig(root);
      server.watcher.add([site.contentDir, site.generatedDir]);

      // Editor endpoints (dev only, localhost only).
      server.middlewares.use(
        '/__editor',
        editorMiddleware({
          root,
          logger: config.logger,
          // R2_* only (Node side): Vite exposes nothing but VITE_* to client code
          env: loadEnv(config.mode, config.envDir || root, 'R2_'),
          drafts,
          onWrite: () => (editorWriteUntil = Date.now() + 2000),
          render: () => server.ssrLoadModule(RENDER_MODULE),
        }),
      );

      // The contact form's POST /api/contact (functions/api/contact.js): checked, logged, not sent
      server.middlewares.use('/api/contact', contactMiddleware(config.logger));

      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'GET') return next();
        const url = new URL(req.url, 'http://localhost');
        const accept = req.headers.accept || '';
        const looksLikePage = !path.extname(url.pathname) || url.pathname.endsWith('.html');
        if (!looksLikePage || (!accept.includes('text/html') && !accept.includes('*/*')))
          return next();
        if (url.pathname.startsWith('/@') || url.pathname.startsWith('/node_modules'))
          return next();
        const moved = legacyRedirect(url); // the old /edit/?path=… addresses
        if (moved || url.pathname === '/sandbox') {
          res.writeHead(302, { Location: moved || '/sandbox/' + url.search });
          return res.end();
        }
        if (url.pathname.startsWith('/sandbox/')) return next(); // mock sandbox (sandbox/index.html)
        try {
          if (wantsEditor(url, req.headers)) {
            // the editor app on this page (src/editor/lib/editor-url.js); its preview gets the site
            const shell = editorShell(
              fs.readFileSync(path.join(root, EDITOR_HTML), 'utf8'),
              loadContent(root).site,
            );
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.end(await server.transformIndexHtml(req.url, shell));
          }
          const { getRoutes, renderRoute } = await server.ssrLoadModule(RENDER_MODULE);
          const draft = url.searchParams.get(DRAFT_PARAM);
          const content = loadContent(root, draftsFor(drafts, draft));
          // the editor's preview (a draft session): [param] pages that build none too (routes.js)
          const routes = getRoutes(content, { unbuilt: !!draft });
          let pathname = url.pathname.replace(/index\.html$/, '');
          if (!pathname.endsWith('/')) pathname += '/';
          let route = routes.find((r) => r.path === pathname);
          if (route?.redirect) {
            // a folder without its own page (routes.js): its first sub page
            res.writeHead(302, { Location: route.redirect + url.search });
            return res.end();
          }
          const status = route ? 200 : 404;
          route ||= routes.find((r) => r.page === 'notFound');
          const shell = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
          const html = await server.transformIndexHtml(
            req.url,
            fill(shell, renderRoute(route, content, { editable: true, unbuilt: !!draft })),
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
      if (file.endsWith('.tmp')) return []; // writeFileAtomic's temporary file (scripts/content.mjs)
      const rel = path.relative(config.root, file).split(path.sep).join('/');
      // content and media manifest files are data: they re-render pages, never hot-update modules
      const site = loadSiteConfig(config.root);
      const content = [site.contentDir, site.generatedDir].some((d) =>
        rel.startsWith(`${posixRel(config.root, d)}/`),
      );
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
      const {
        buildRedirects,
        buildRoutes,
        ownPageRedirects,
        redirectPage,
        pathsOf,
        redirectsText,
        renderRoute,
        bindingChecks,
        motionChecks,
        seoWarnings,
        sitemapXml,
      } = await import(pathToFileURL(path.join(root, RENDER_MODULE)).href + `?t=${Date.now()}`);
      const content = loadContent(root);
      // every source against its schema (required fields, types, photos): stop on a mistake
      const problems = checkSources(content);
      if (problems.length) throw new Error(`Content problems:\n  ${problems.join('\n  ')}`);
      // bindings against the sources' schemas: a wrong one stops, an empty one warns
      const bindings = bindingChecks(content);
      const wrong = bindings.filter((p) => p.level === 'error').map((p) => p.message);
      if (wrong.length) throw new Error(`Binding problems:\n  ${wrong.join('\n  ')}`);
      for (const p of bindings) config.logger.warn(`\x1b[33m[bindings]\x1b[0m ${p.message}`);
      // every widget's animation is in the library
      const motion = motionChecks(content);
      if (motion.length) throw new Error(`Motion problems:\n  ${motion.join('\n  ')}`);
      const { routes, warnings } = buildRoutes(content);
      for (const w of warnings) config.logger.warn(`\x1b[33m[routes]\x1b[0m ${w}`);
      for (const w of seoWarnings(routes)) config.logger.warn(`\x1b[33m[seo]\x1b[0m ${w}`);

      for (const route of routes) {
        const rel = route.out || path.join(route.path, 'index.html');
        const file = path.join(outDir, rel);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        // a folder without its own page: a redirect page (and a 302 in _redirects)
        fs.writeFileSync(
          file,
          route.redirect ? redirectPage(route.redirect) : fill(shell, renderRoute(route, content)),
        );
      }
      fs.writeFileSync(path.join(outDir, 'sitemap.xml'), sitemapXml(routes, content.site.url));
      fs.writeFileSync(
        path.join(outDir, 'robots.txt'),
        `User-agent: *\nAllow: /\nSitemap: ${content.site.url}/sitemap.xml\n`,
      );
      // Cloudflare Pages / Netlify: "from to status" per line
      const redirects = buildRedirects(content.redirects, pathsOf(content));
      for (const w of redirects.warnings) config.logger.warn(`\x1b[33m[redirects]\x1b[0m ${w}`);
      const text = redirectsText([...ownPageRedirects(routes), ...redirects.list]);
      fs.writeFileSync(path.join(outDir, '_redirects'), text && `${text}\n`);

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
