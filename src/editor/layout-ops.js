/**
 * Page layout edits in the store: sections and their blocks added, duplicated, moved,
 * removed and placed (src/site/layout/index.js). Each is one undo step. Adding, duplicating,
 * moving and removing are `structure` changes: the preview renders the sections they touch
 * again (src/editor/layout-sync.js); placing a block or changing a section's settings it
 * follows by itself, through the elements' classes and CSS variables.
 */
import { newBlock, newSection, rowsOf, placeOf } from '../site/layout/index.js';
import { idsOf, newId } from '../site/layout/ids.js';

const listOf = (store, file) => {
  const list = store.get(file, '/sections');
  return Array.isArray(list) ? structuredClone(list) : [];
};
const write = (store, file, list, structure = true) =>
  store.set(file, '/sections', list, { source: 'panel', structure });
/**
 * Section `at` replaced by `section` (its rows grown to fit its blocks): no new render.
 * key: typing in one field (a number) coalesces into one undo step (store.js).
 */
const writeSection = (store, file, at, section, key) =>
  store.set(
    file,
    `/sections/${at}`,
    { ...section, rows: rowsOf(section) },
    { source: 'panel', key },
  );

/** A copy of a section ('s') or block ('b') with new ids (taken: the page's ids, the new ones added). */
function copyOf(item, kind, taken) {
  const copy = structuredClone(item);
  copy.id = newId(kind, taken);
  for (const b of copy.blocks || []) b.id = newId('b', taken);
  return copy;
}

/** A new section at index `at` (default: the end), holding a full-width block of `type` when given. */
export function addSection(store, file, type, at) {
  const list = listOf(store, file);
  const taken = idsOf(list);
  const blocks = type ? [newBlock(type, taken)] : [];
  list.splice(at ?? list.length, 0, newSection(taken, blocks));
  return write(store, file, list);
}

/** A copy of section `at` (new ids), right after it. */
export function duplicateSection(store, file, at) {
  const list = listOf(store, file);
  list.splice(at + 1, 0, copyOf(list[at], 's', idsOf(list)));
  return write(store, file, list);
}

/** Section `from` moved to index `to`. */
export function moveSection(store, file, from, to) {
  const list = listOf(store, file);
  if (to < 0 || to >= list.length || from === to) return false;
  list.splice(to, 0, ...list.splice(from, 1));
  return write(store, file, list);
}

/** Section `at` removed. */
export function removeSection(store, file, at) {
  const list = listOf(store, file);
  list.splice(at, 1);
  return write(store, file, list);
}

/**
 * Section `at`'s settings (height, align, rows, width, spacing, enabled) changed by `patch`;
 * key: see writeSection.
 */
export function setSection(store, file, at, patch, key) {
  const section = listOf(store, file)[at];
  return writeSection(store, file, at, { ...section, ...patch }, key);
}

/** The first free row below every block of a section. */
const below = (section) =>
  Math.max(0, ...(section.blocks || []).map((b) => placeOf(b.pos).row + placeOf(b.pos).rows - 1)) +
  1;

/** A new full-width block of `type` in section `at`, below its other blocks. */
export function addBlock(store, file, at, type) {
  const list = listOf(store, file);
  const section = list[at];
  const first = !section.blocks?.length;
  const block = newBlock(type, idsOf(list), { row: first ? 1 : below(section) });
  section.blocks = [...(section.blocks || []), block];
  section.rows = rowsOf(section);
  write(store, file, list);
  return block;
}

/** A copy of block `j` of section `at` (new id), right after it in order and below the others. */
export function duplicateBlock(store, file, at, j) {
  const list = listOf(store, file);
  const section = list[at];
  const copy = copyOf(section.blocks[j], 'b', idsOf(list));
  copy.pos = { ...placeOf(copy.pos), row: below(section) };
  section.blocks.splice(j + 1, 0, copy);
  section.rows = rowsOf(section);
  write(store, file, list);
  return copy;
}

/** Block `from` of section `at` moved to index `to` in its order (the mobile stacking order). */
export function moveBlock(store, file, at, from, to) {
  const list = listOf(store, file);
  const blocks = list[at].blocks;
  if (to < 0 || to >= blocks.length || from === to) return false;
  blocks.splice(to, 0, ...blocks.splice(from, 1));
  return write(store, file, list);
}

/** Block `j` of section `at` removed. */
export function removeBlock(store, file, at, j) {
  const list = listOf(store, file);
  list[at].blocks.splice(j, 1);
  return write(store, file, list);
}

/**
 * Block `j` of section `at` placed at `pos` (the section grows to fit it): one undo step (a
 * drag); key: typing in a number field coalesces (see writeSection).
 */
export function placeBlock(store, file, at, j, pos, key) {
  const section = listOf(store, file)[at];
  section.blocks[j].pos = placeOf(pos);
  return writeSection(store, file, at, section, key);
}

/** Block `j` of section `at` one layer up (dir 1) or down (-1). */
export function layerBlock(store, file, at, j, dir) {
  const section = listOf(store, file)[at];
  const block = section.blocks[j];
  const z = (Number.isInteger(block.z) ? block.z : 0) + dir;
  if (z) block.z = z;
  else delete block.z;
  return writeSection(store, file, at, section);
}
