import { html, esc, img, pad, ed, lines, words, isEnabled, sectionAttrs } from '../helpers.js';
import { HOME, sourceFile } from '../files.js';
import { sectionHead, projectList } from './partials.js';

const heroPhoto = (ctx, p, i) => {
  const mobile = p.mx !== undefined;
  const style = `--x:${p.x}%;--y:${p.y}%;--w:${p.w}vw;${mobile ? `--mx:${p.mx}%;--my:${p.my}%;--mw:${p.mw}vw;` : ''}`;
  return html` <a
    class="scatter scatter--${p.layer === 'front' ? 'front' : 'back'}${mobile ? '' : ' scatter--desktop'}"
    href="${esc(p.link)}"
    style="${style}"
    data-depth="${p.depth}"
    aria-label="${esc(p.label)}"
  >
    <span class="scatter__drift"
      ><span class="scatter__frame">
        ${img(ctx, p.src, { alt: '', sizes: `(max-width: 760px) ${p.mw || 30}vw, ${p.w}vw`, priority: i < 5 })}
      </span></span
    >
  </a>`;
};

/** Interleave the first N images of each person for the home "People" grid. */
const peopleTiles = (people, perPerson = 4) => {
  const tiles = [];
  for (let i = 0; i < perPerson; i++)
    for (const p of people)
      if (p.images[i]) tiles.push({ person: p, image: p.images[i], index: i });
  return tiles;
};

export function home(ctx) {
  const { home, people, places, projects, site } = ctx;
  const { hero, sections } = home;
  const introOn = isEnabled(sections?.intro);
  return html` <section class="hero" data-hero${sectionAttrs('hero', hero.enabled !== false)}>
      <div class="hero__photos" data-anim="hero.photos">
        ${hero.photos.map((p, i) => heroPhoto(ctx, p, i))}
      </div>
      <h1 class="hero__title" data-anim="hero.title">
        <span class="hero__name" ${ed(HOME, ['hero', 'title'], 'words')}
          >${words(hero.title ?? site.name)}</span
        >
      </h1>
      <div class="hero__meta" data-anim="hero.meta">
        <span class="label" ${ed(HOME, ['hero', 'eyebrow'])}>${esc(hero.eyebrow)}</span>
        <span class="hero__scroll label" aria-hidden="true"><i></i>Scroll</span>
        <p class="hero__subline" ${ed(HOME, ['hero', 'subline'], 'block')}>
          ${lines(hero.subline)}
        </p>
      </div>
    </section>

    <section class="intro" ${sectionAttrs('intro', introOn)}>
      <p class="intro__text" data-anim="home.intro" ${ed(HOME, ['intro'], 'block')}>
        ${lines(home.intro)}
      </p>
    </section>

    <section class="section section--people" ${sectionAttrs('people', isEnabled(sections.people))}>
      ${sectionHead({ key: 'people', index: 1, ...sections.people, href: '/people/' })}
      <div class="tiles" data-anim="home.people.grid">
        ${peopleTiles(people).map(
          ({ person, image, index }) => html`
      <a class="tile" href="/people/${person.slug}/#${index + 1}" data-anim-item>
        <span class="tile__media">${img(ctx, image.src, { alt: image.alt, sizes: '(max-width: 760px) 50vw, 25vw' })}</span>
        <span class="tile__cap"><span${ed(sourceFile('people'), [people.indexOf(person), 'name'])}>${esc(person.name)}</span><span>${pad(index + 1)}</span></span>
      </a>`,
        )}
      </div>
    </section>

    <section class="section section--places" ${sectionAttrs('places', isEnabled(sections.places))}>
      ${sectionHead({ key: 'places', index: 2, ...sections.places, href: '/places/' })}
      <div class="placecards" data-anim="home.places.grid">
        ${places.map(
          (p, i) => html`
      <a class="placecard" href="/places/${p.slug}/" data-anim-item>
        <span class="placecard__media">${img(ctx, p.images[p.cover || 0].src, { alt: p.images[p.cover || 0].alt, sizes: '(max-width: 760px) 100vw, 50vw', attrs: 'data-anim="place.card.image"' })}</span>
        <span class="placecard__info">
          <span class="placecard__name"${ed(sourceFile('places'), [i, 'name'])}>${esc(p.name)}</span>
          <span class="label"><span${ed(sourceFile('places'), [i, 'location'])}>${esc(p.location)}</span> · <span${ed(sourceFile('places'), [i, 'year'], 'number')}>${esc(p.year)}</span> · ${pad(p.images.length)} photos</span>
        </span>
      </a>`,
        )}
      </div>
    </section>

    <section
      class="section section--projects"
      ${sectionAttrs('projects', isEnabled(sections.projects))}
    >
      ${sectionHead({ key: 'projects', index: 3, ...sections.projects, href: '/projects/' })}
      ${projectList(ctx, projects, { id: 'home-projects' })}
    </section>`;
}
