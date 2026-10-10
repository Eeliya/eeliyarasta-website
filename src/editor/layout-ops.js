/**
 * Page layout edits in the store: sections and their blocks added, duplicated, moved,
 * removed and placed (src/site/layout/index.js). Each is one undo step. Adding, duplicating,
 * moving and removing are `structure` changes: the preview renders the sections they touch
 * again (src/editor/layout-sync.js); placing a block or changing a section's settings it
 * follows by itself, through the elements' classes and CSS variables.
 */
import { MCOLS, newBlock, newSection, rowsOf, placeOf } from '../site/layout/index.js';
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
 * Section `at`'s settings (height, aspect, align, rows, width, spacing, mobile, enabled) changed
 * by `patch` (a key set to undefined is removed);
 * key: see writeSection.
 */
export function setSection(store, file, at, patch, key) {
  const next = { ...listOf(store, file)[at], ...patch };
  for (const k of Object.keys(patch)) if (patch[k] === undefined) delete next[k];
  return writeSection(store, file, at, next, key);
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
 * The rows the page shows (src/site/layout/flow.js) stored: flow { id: area } where the
 * section's other blocks are now (their row and rows; `phone`: their mobile areas), rows the
 * section's rows now. Blocks that grew or shrank (content, an aspect at this width) and the
 * blocks they pushed are stored as they are seen.
 */
function storeFlow(section, j, flow = {}, rows = 0, phone = false) {
  section.blocks.forEach((b, k) => {
    const a = k !== j && flow[b.id];
    if (!a) return;
    if (phone) b.mobile = { ...b.mobile, row: a.row, rows: a.rows };
    else b.pos = { ...placeOf(b.pos), row: a.row, rows: a.rows };
  });
  if (!phone && Number.isInteger(rows) && rows > 0) section.rows = rows;
}

/**
 * Block `j` of section `at` placed at `pos` (the section grows to fit it): one undo step (a
 * drag); key: typing in a number field coalesces (see writeSection). flow, rows: where the
 * other blocks are now and the section's rows (storeFlow).
 */
export function placeBlock(store, file, at, j, pos, key, { flow, rows } = {}) {
  const section = listOf(store, file)[at];
  storeFlow(section, j, flow, rows);
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

/**
 * Block `j` of section `at` changed by `patch` (size, aspect, place; a key set to undefined is
 * removed): one undo step; key: see writeSection.
 */
export function setBlock(store, file, at, j, patch, key) {
  const section = listOf(store, file)[at];
  const block = section.blocks[j];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete block[k];
    else block[k] = v;
  }
  return writeSection(store, file, at, section, key);
}

/** A block's `mobile` with `patch` (area keys, place); removed when nothing is left. */
function setMobile(block, patch) {
  const next = { ...block.mobile, ...patch };
  for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
  if (Object.keys(next).length) block.mobile = next;
  else delete block.mobile;
}

/**
 * Block `j` of section `at` placed at `area` on the phone grid (24 columns). stack: the areas
 * the section's other blocks had in the stack ({ id: area }), when this turns the section from
 * a stack into a grid (they keep their places). One undo step; key: see writeSection.
 */
export function placeMobile(store, file, at, j, area, { stack = {}, key, flow } = {}) {
  const section = listOf(store, file)[at];
  storeFlow(section, j, flow, 0, true);
  section.blocks.forEach((b, k) => {
    if (k === j) setMobile(b, placeOf(area, MCOLS));
    else if (stack[b.id] && !['col', 'span', 'row', 'rows'].some((x) => b.mobile?.[x]))
      setMobile(b, placeOf(stack[b.id], MCOLS));
  });
  return writeSection(store, file, at, section, key);
}

/** Block `j`'s placement on phones ('none' or undefined: in the flow). */
export function placeOnPhone(store, file, at, j, place) {
  const section = listOf(store, file)[at];
  setMobile(section.blocks[j], { place: place && place !== 'none' ? place : undefined });
  return writeSection(store, file, at, section);
}

/** Section `at` stacked again on phones: its blocks' mobile areas and placements removed. */
export function resetMobile(store, file, at) {
  const section = listOf(store, file)[at];
  if (!section.blocks.some((b) => b.mobile)) return false;
  for (const b of section.blocks) delete b.mobile;
  return writeSection(store, file, at, section);
}
