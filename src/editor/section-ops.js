/**
 * Add, duplicate, move and remove page sections in the store: each is one undo step that
 * writes the page's whole "sections" list (so undo/redo and Save treat it like any edit).
 * Adding, duplicating and removing are `structure` changes: the preview renders the page
 * again (a move it follows by itself, src/editor/sections.js).
 */
import { newSection } from '../site/sections/index.js';

const listOf = (store, file) => {
  const list = store.get(file, '/sections');
  return Array.isArray(list) ? [...list] : [];
};
const write = (store, file, list, structure = true) =>
  store.set(file, '/sections', list, { source: 'panel', structure });

/** A new section of `type` (its defaults) at index `at` (default: the end). */
export function addSection(store, file, type, at) {
  const list = listOf(store, file);
  list.splice(at ?? list.length, 0, newSection(type));
  return write(store, file, list);
}

/** A copy of section `at`, right after it. */
export function duplicateSection(store, file, at) {
  const list = listOf(store, file);
  list.splice(at + 1, 0, structuredClone(list[at]));
  return write(store, file, list);
}

/** Section `from` moved to index `to`. */
export function moveSection(store, file, from, to) {
  const list = listOf(store, file);
  if (to < 0 || to >= list.length || from === to) return false;
  list.splice(to, 0, ...list.splice(from, 1));
  return write(store, file, list, false);
}

/** Section `at` removed. */
export function removeSection(store, file, at) {
  const list = listOf(store, file);
  list.splice(at, 1);
  return write(store, file, list);
}
