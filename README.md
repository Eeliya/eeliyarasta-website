# eeliyarasta.com

Personal site of **Eeliya Rasta**: portrait & editorial photography (Fujifilm X100V) first,
websites and DIY projects second.

This repo is the site only: its content, photos, theme and config. The engine (templates,
build, the visual editor) is [ewcms](https://github.com/EverythingWidget/ewcms), a dependency
pinned by tag in `package.json`; its README documents the content shape, the layout, widgets,
animations and the editor.

```
content/en/               ← all text, pages, sources, settings (JSON)
media/                    ← source photos (ewcms images → public/media, git-ignored)
theme/                    ← theme.json + styles/: fonts, colours, the look
public/                   ← fonts, favicon (copied as is)
site.config.mjs           ← where the folders are
functions/api/contact.js  ← the contact form (Cloudflare Pages Function, from ewcms)
.env.example              ← R2 keys for the editor's uploads (copy to .env.local)
```

```bash
npm install
npm run dev            # http://localhost:5173 (hot reload); the editor: http://localhost:5173/?edit
npm run build          # → dist/
npm run preview        # serve dist/ on http://localhost:4173
npm run check          # content + theme/JS lint (the pre-push hook runs it)
npm run check:links    # after a build: every internal link in dist/ points at a file
npm run images         # media/ → public/media (dev and build run it first)
npm run publish-media  # media/ photos → Cloudflare R2 (.env.local)
```

Requires Node `^20.19.0 || >=22.12.0`.

**With ewcms checked out next to it** (the `ewcms-dev` workspace, see ewcms's README "Working on
ewcms and a site together"): `npm install` at the workspace root links `node_modules/ewcms` to
the local `ewcms/` folder, so engine edits show up in `npm run dev` right away, no npm link.

**Upgrading ewcms:** change `#v0.1.1` in `package.json` to the new tag, `npm install`, commit
`package.json` and `package-lock.json`.

## Deploy

Cloudflare Pages: build command `npm run build`, output directory `dist`. `dist/_redirects` and
`functions/` (the contact form: `RESEND_API_KEY`, `CONTACT_TO`, `CONTACT_FROM`, optional
`TURNSTILE_SECRET_KEY`, see `.env.example`) work as before. `npm ci` fetches ewcms from GitHub,
so the build needs read access to `EverythingWidget/ewcms`.
