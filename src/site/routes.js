/**
 * Every page of the site, derived from content. The prerender step writes one
 * static HTML file per route; the client router fetches those same files.
 */
export function getRoutes(content) {
  const { site, people, places } = content;
  const albums = (kind, list, section) =>
    list.map((album, i) => ({
      path: `/${kind}/${album.slug}/`,
      page: 'album',
      kind,
      section,
      album,
      index: i,
      file: `${kind}.json`,
      next: list[(i + 1) % list.length],
      title: `${album.name} | ${section} | ${site.name}`,
      description: album.summary,
      image: album.images[album.cover || 0]?.src,
    }));

  return [
    { path: '/', page: 'home', title: site.title, description: site.description },
    { path: '/photography/', page: 'photography', title: `Photography | ${site.name}`, description: 'People and places photographed by Eeliya Rasta.' },
    { path: '/people/', page: 'people', title: `People | ${site.name}`, description: `Models photographed by ${site.name}.` },
    ...albums('people', people, 'People'),
    { path: '/places/', page: 'places', title: `Places | ${site.name}`, description: `Places and architecture photographed by ${site.name}.` },
    ...albums('places', places, 'Places'),
    { path: '/projects/', page: 'projects', title: `Projects | ${site.name}`, description: `Websites, tools and DIY things built by ${site.name}.` },
    { path: '/about/', page: 'about', title: `About | ${site.name}`, description: site.description },
    { path: '/404/', page: 'notFound', out: '404.html', title: `Not found | ${site.name}`, description: 'Page not found.', noindex: true },
  ];
}
