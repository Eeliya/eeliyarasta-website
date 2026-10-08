/**
 * Every page of the site, derived from content. The prerender step writes one
 * static HTML file per route; the client router fetches those same files.
 */

/** Curtain label shown during page transitions. Explicit "" means no text; missing falls back to the title. */
function curtainOf(explicit, title) {
  if (explicit !== undefined && explicit !== null) return String(explicit);
  return String(title || "").split("|")[0].trim();
}

/** data-curtain-edit value: content file + JSON pointer the editor writes to. */
function curtainEditOf(file, parts) {
  const ptr = parts.map((p) => "/" + String(p).replace(/~/g, "~0").replace(/\//g, "~1")).join("");
  return `${file}#${ptr}`;
}

export function getRoutes(content) {
  const { site, people, places, home } = content;
  const albums = (kind, list, section) =>
    list.map((album, i) => {
      const title = `${album.name} | ${section} | ${site.name}`;
      return {
        path: `/${kind}/${album.slug}/`,
        page: "album",
        kind,
        section,
        album,
        index: i,
        file: `${kind}.json`,
        next: list[(i + 1) % list.length],
        title,
        description: album.summary,
        image: album.images[album.cover || 0]?.src,
        curtain: curtainOf(album.curtain, title),
        curtainEdit: curtainEditOf(`${kind}.json`, [i, "curtain"]),
      };
    });

  const pageCurtain = (key, title) => ({
    curtain: curtainOf(site.pages[key]?.curtain, title),
    curtainEdit: curtainEditOf("site.json", ["pages", key, "curtain"]),
  });

  const homeTitle = site.title;
  return [
    {
      path: "/",
      page: "home",
      title: homeTitle,
      description: site.description,
      curtain: curtainOf(home?.curtain, homeTitle),
      curtainEdit: curtainEditOf("home.json", ["curtain"]),
    },
    { path: "/photography/", page: "photography", title: `Photography | ${site.name}`, description: "People and places photographed by Eeliya Rasta.", ...pageCurtain("photography", `Photography | ${site.name}`) },
    { path: "/people/", page: "people", title: `People | ${site.name}`, description: `Models photographed by ${site.name}.`, ...pageCurtain("people", `People | ${site.name}`) },
    ...albums("people", people, "People"),
    { path: "/places/", page: "places", title: `Places | ${site.name}`, description: `Places and architecture photographed by ${site.name}.`, ...pageCurtain("places", `Places | ${site.name}`) },
    ...albums("places", places, "Places"),
    { path: "/projects/", page: "projects", title: `Projects | ${site.name}`, description: `Websites, tools and DIY things built by ${site.name}.`, ...pageCurtain("projects", `Projects | ${site.name}`) },
    { path: "/about/", page: "about", title: `About | ${site.name}`, description: site.description, ...pageCurtain("about", `About | ${site.name}`) },
    { path: "/404/", page: "notFound", out: "404.html", title: `Not found | ${site.name}`, description: "Page not found.", noindex: true, ...pageCurtain("notFound", `Not found | ${site.name}`) },
  ];
}
