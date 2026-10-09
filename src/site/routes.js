/**
 * Every page of the site, derived from content. The prerender step writes one
 * static HTML file per route; the client router fetches those same files.
 */
import { SITE, HOME, sourceFile } from './files.js';
import { coverOf } from './helpers.js';
import { curtainMode } from '../client/anim/curtain.js';

/** Curtain label shown during page transitions. Explicit "" means no text; missing falls back to the title. */
function curtainOf(explicit, title) {
  if (explicit !== undefined && explicit !== null) return String(explicit);
  return String(title || '')
    .split('|')[0]
    .trim();
}

/** Edit pointer ("file#/json/pointer") of a page value, e.g. its curtain text. */
function curtainEditOf(file, parts) {
  const ptr = parts.map((p) => '/' + String(p).replace(/~/g, '~0').replace(/\//g, '~1')).join('');
  return `${file}#${ptr}`;
}

/**
 * Every route has its curtain text (curtain, curtainEdit) and its page transition
 * (transition, transitionEdit): where it is stored next to that text. The transition says
 * which curtain plays when navigating to the page: see curtainFor in client/anim/curtain.js.
 */
export function getRoutes(content) {
  const { site, people, places, home } = content;
  const albums = (kind, list, section) =>
    list.map((album, i) => {
      const title = `${album.name} | ${section} | ${site.name}`;
      return {
        path: `/${kind}/${album.slug}/`,
        page: 'album',
        kind,
        section,
        album,
        index: i,
        file: sourceFile(kind),
        next: list[(i + 1) % list.length],
        title,
        description: album.summary,
        image: coverOf(album)?.src,
        curtain: curtainOf(album.curtain, title),
        curtainEdit: curtainEditOf(sourceFile(kind), [i, 'curtain']),
        transition: album.transition,
        transitionEdit: curtainEditOf(sourceFile(kind), [i, 'transition']),
      };
    });

  const pageCurtain = (key, title) => ({
    curtain: curtainOf(site.pages[key]?.curtain, title),
    curtainEdit: curtainEditOf(SITE, ['pages', key, 'curtain']),
    transition: site.pages[key]?.transition,
    transitionEdit: curtainEditOf(SITE, ['pages', key, 'transition']),
  });

  const homeTitle = site.title;
  return [
    {
      path: '/',
      page: 'home',
      title: homeTitle,
      description: site.description,
      curtain: curtainOf(home?.curtain, homeTitle),
      curtainEdit: curtainEditOf(HOME, ['curtain']),
      transition: home?.transition,
      transitionEdit: curtainEditOf(HOME, ['transition']),
    },
    {
      path: '/photography/',
      page: 'photography',
      title: `Photography | ${site.name}`,
      description: 'People and places photographed by Eeliya Rasta.',
      ...pageCurtain('photography', `Photography | ${site.name}`),
    },
    {
      path: '/people/',
      page: 'people',
      title: `People | ${site.name}`,
      description: `Models photographed by ${site.name}.`,
      ...pageCurtain('people', `People | ${site.name}`),
    },
    ...albums('people', people, 'People'),
    {
      path: '/places/',
      page: 'places',
      title: `Places | ${site.name}`,
      description: `Places and architecture photographed by ${site.name}.`,
      ...pageCurtain('places', `Places | ${site.name}`),
    },
    ...albums('places', places, 'Places'),
    {
      path: '/projects/',
      page: 'projects',
      title: `Projects | ${site.name}`,
      description: `Websites, tools and DIY things built by ${site.name}.`,
      ...pageCurtain('projects', `Projects | ${site.name}`),
    },
    {
      path: '/about/',
      page: 'about',
      title: `About | ${site.name}`,
      description: site.description,
      ...pageCurtain('about', `About | ${site.name}`),
    },
    {
      path: '/404/',
      page: 'notFound',
      out: '404.html',
      title: `Not found | ${site.name}`,
      description: 'Page not found.',
      noindex: true,
      ...pageCurtain('notFound', `Not found | ${site.name}`),
    },
  ];
}

/** Pages with their own curtain or none: { "/about/": { mode: 'off' }, ... } for the router. */
export function curtainOverrides(routes) {
  return Object.fromEntries(
    routes.filter((r) => curtainMode(r.transition) !== 'global').map((r) => [r.path, r.transition]),
  );
}
