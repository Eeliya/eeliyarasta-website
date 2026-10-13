/**
 * `live`: a reactive view of the editor store (../store.js) for Svelte components.
 *
 * The store stays plain JavaScript with an on() event. Every store event bumps `version`;
 * everything below reads `version` first, so a component that uses it re-renders after
 * each edit, undo, save, ... without knowing about store events.
 */
import { contentFromFiles } from '../../site/files.js';
import { getRoutes } from '../../site/routes.js';

const copy = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));

export function createLive(store) {
  let version = $state(0);
  store.on(() => version++);
  // the site's routes, built once per store change for everyone who asks (not per reader)
  let routesAt = -1;
  let routes = [];
  const routesNow = () => {
    if (routesAt !== version) {
      routes = getRoutes(contentFromFiles(store.current));
      routesAt = version;
    }
    return routes;
  };

  return {
    store,
    /** Read it to re-run after every store change (e.g. to re-read something outside the store). */
    get version() {
      return version;
    },
    /** Every route of the site with the edits (routes.js), shared: built once per change. */
    get routes() {
      version;
      return routesNow();
    },
    /** The route of `path` ("/about/"), or undefined. */
    routeOf(path) {
      return this.routes.find((r) => r.path === path);
    },
    /** A copy of a file's edited value. A new object each time, so Svelte sees in-place edits. */
    current(file) {
      version;
      return copy(store.current[file]);
    },
    /** A copy of a file's last saved value. */
    base(file) {
      version;
      return copy(store.base[file]);
    },
    /** One edited value, e.g. get('pages/index.json', '/sections/0/title'). Don't change it in place. */
    get(file, ptr) {
      version;
      return store.get(file, ptr);
    },
    /** One last saved value. */
    getBase(file, ptr) {
      version;
      return store.getBase(file, ptr);
    },
    /** Does the value at file#ptr differ from the saved one? */
    changed(file, ptr) {
      version;
      return store.changedAt(file, ptr);
    },
    get canUndo() {
      version;
      return store.canUndo();
    },
    get canRedo() {
      version;
      return store.canRedo();
    },
    /** Number of unsaved changes over all files (one per changed value). */
    get changes() {
      version;
      return store.dirtyFiles().reduce((n, f) => n + store.changes(f).length, 0);
    },
  };
}
