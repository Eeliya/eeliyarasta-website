/**
 * Page layout edits in the store: sections and their blocks added, duplicated, moved,
 * removed and placed (src/site/layout/index.js). Each is one undo step. Adding, duplicating,
 * moving and removing are `structure` changes: the preview renders the sections they touch
 * again (src/editor/layout-sync.js); placing a block or changing a section's settings it
 * follows by itself, through the elements' classes and CSS variables.
 */
import {
  MAX_MIN_ROWS,
  MCOLS,
  HEIGHTS,
  minRowsOf,
  mobileMinRowsOf,
  phoneHeightOf,
  mobileRowsOf,
  rowsOf,
  hasMobileArea,
  linkOf,
  makesLoop,
  newBlock,
  newSection,
  phoneAreaOf,
  placeOf,
} from '../site/layout/index.js';
import { resolveRows } from '../site/layout/flow.js';
import { idsOf, newId } from '../site/layout/ids.js';

const listOf = (store, file) => {
  const list = store.get(file, '/sections');
  return Array.isArray(list) ? structuredClone(list) : [];
};
const write = (store, file, list, structure = true) =>
  store.set(file, '/sections', list, { source: 'panel', structure });
/**
 * A section's stored rows made to agree with its links (src/site/layout/links.js): a linked
 * block's stored row is its leader's stored bottom + 1 + its gap (desktop; on the phone grid
 * for blocks with a phone area and link of their own), so the page's first render (before
 * rows.js measures, or without JS) already has every follower below its leader.
 */
export function settleLinks(section) {
  const blocks = section.blocks || [];
  const desk = resolveRows(
    blocks.map((b) => ({ id: b.id, ...placeOf(b.pos), link: linkOf(b) })),
    1,
  ).at;
  const own = blocks.filter((b) => hasMobileArea(b.mobile));
  const phone = resolveRows(
    own.map((b) => ({ id: b.id, ...placeOf(b.mobile, MCOLS), link: linkOf(b, true) })),
    1,
  ).at;
  for (const b of blocks) {
    if (linkOf(b) && desk[b.id]) b.pos = { ...placeOf(b.pos), row: desk[b.id].row };
    if (linkOf(b, true) && phone[b.id]) b.mobile = { ...b.mobile, row: phone[b.id].row };
  }
  return section;
}

/**
 * Section `at` replaced by `section` (its links settled; its rows are down to its lowest block,
 * so none are stored): no new render. key: typing in one field (a number) coalesces into one undo step (store.js).
 */
const writeSection = (store, file, at, section, key) => {
  settleLinks(section);
  return store.set(file, `/sections/${at}`, section, { source: 'panel', key });
};

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
 * Section `at`'s settings (name, height, width, enabled) changed
 * by `patch` (a key set to undefined is removed);
 * key: see writeSection.
 */
export function setSection(store, file, at, patch, key) {
  const next = { ...listOf(store, file)[at], ...patch };
  for (const k of Object.keys(patch)) if (patch[k] === undefined) delete next[k];
  return writeSection(store, file, at, tidyMobile(next), key);
}

/** Its phone rows only while its phone height is custom; no empty `mobile`. */
function tidyMobile(s) {
  if (!s.mobile || typeof s.mobile !== 'object' || 'spacing' in s.mobile) return s;
  const m = { ...s.mobile };
  if (phoneHeightOf(s) !== 'custom') delete m.minRows;
  if (Object.keys(m).length) s.mobile = m;
  else delete s.mobile;
  return s;
}

/**
 * A section's height on phones (section.mobile.height), its desktop height untouched; undefined:
 * its own is removed, the phone follows the desktop again. Custom: its phone rows to start from
 * (its own, the desktop's halved, or its content's on the phone grid). One undo step.
 */
export function setPhoneHeight(store, file, at, height) {
  const s = listOf(store, file)[at];
  if (!s || (height !== undefined && !HEIGHTS.includes(height))) return false;
  if (height === s.mobile?.height) return false;
  const mobile = { ...s.mobile, height };
  if (height === undefined) delete mobile.height;
  if (height === 'custom' && !Number.isInteger(mobile.minRows))
    mobile.minRows = Math.ceil(minRowsOf(s) / 2) || mobileRowsOf(s);
  return setSection(store, file, at, { mobile });
}

/**
 * A Custom section whose content now reaches below its rows (a block dragged or resized past
 * its bottom): its rows become its content's, so they stay when the block moves back up (the
 * phone's own rows on the phone). Only ever grows. In place, part of the move's undo step.
 */
function grow(section, content, phone = false) {
  const now = phone ? mobileMinRowsOf(section) : minRowsOf(section);
  if (!now || content <= now) return;
  const rows = Math.min(MAX_MIN_ROWS, content);
  if (phone) section.mobile = { ...section.mobile, minRows: rows };
  else section.minRows = rows;
}

/**
 * A Custom section's rows set from the preview (its bottom edge dragged, or its Rows field):
 * `rows` on the desktop grid, or on the phone's (phone: its own phone rows, mobile.minRows; the
 * desktop's are untouched). Clamped to 1..MAX_MIN_ROWS; false when it isn't Custom or nothing
 * changed. One undo step (key: a field's typing coalesces).
 */
export function setSectionRows(store, file, at, rows, { phone = false, key } = {}) {
  const s = listOf(store, file)[at];
  if (!s || (phone ? phoneHeightOf(s) : s.height) !== 'custom' || !Number.isFinite(rows))
    return false;
  const n = Math.min(MAX_MIN_ROWS, Math.max(1, Math.round(rows)));
  if (phone) {
    if (n === s.mobile?.minRows) return false;
    return setSection(store, file, at, { mobile: { ...s.mobile, minRows: n } }, key);
  }
  if (n === s.minRows) return false;
  return setSection(store, file, at, { minRows: n }, key);
}

/** The first free row below every block of a section. */
const below = (section) =>
  Math.max(0, ...(section.blocks || []).map((b) => placeOf(b.pos).row + placeOf(b.pos).rows - 1)) +
  1;

/** A new full-width block of `type` in section `at`, below its other blocks (free: no link). */
export function addBlock(store, file, at, type) {
  const list = listOf(store, file);
  const section = list[at];
  const first = !section.blocks?.length;
  const block = newBlock(type, idsOf(list), { row: first ? 1 : below(section) });
  section.blocks = [...(section.blocks || []), block];
  write(store, file, list);
  return block;
}

/** A copy of block `j` of section `at` (new id), right after it in order and below the others. */
export function duplicateBlock(store, file, at, j) {
  const list = listOf(store, file);
  const section = list[at];
  const copy = copyOf(section.blocks[j], 'b', idsOf(list));
  copy.pos = { ...placeOf(copy.pos), row: below(section) };
  // a copy is free (its links were the original's place)
  delete copy.link;
  if (copy.mobile) {
    delete copy.mobile.link;
    if (!hasMobileArea(copy.mobile) && !copy.mobile.place) delete copy.mobile;
  }
  section.blocks.splice(j + 1, 0, copy);
  write(store, file, list);
  return copy;
}

/** Block `from` of section `at` moved to index `to` in its order (its paint order among blocks of the same layer). */
export function moveBlock(store, file, at, from, to) {
  const list = listOf(store, file);
  const blocks = list[at].blocks;
  if (to < 0 || to >= blocks.length || from === to) return false;
  blocks.splice(to, 0, ...blocks.splice(from, 1));
  return write(store, file, list);
}

/** Block `j` of section `at` removed (the blocks that followed it are free from then on). */
export function removeBlock(store, file, at, j) {
  const list = listOf(store, file);
  const [gone] = list[at].blocks.splice(j, 1);
  for (const b of list[at].blocks) {
    if (b.link?.to === gone?.id) delete b.link;
    if (b.mobile?.link?.to === gone?.id) delete b.mobile.link;
  }
  return write(store, file, list);
}

/**
 * The rows the page shows (src/site/layout/flow.js) stored: flow { id: area } where the
 * section's other blocks are now (their row and rows; `phone`: their mobile areas). Blocks that grew or shrank (content, an aspect at this width) and the
 * blocks they pushed are stored as they are seen.
 */
function storeFlow(section, j, flow = {}, phone = false) {
  section.blocks.forEach((b, k) => {
    const a = k !== j && flow[b.id];
    if (!a) return;
    // on the phone only a block's own phone area (one without shows its desktop area halved)
    if (phone) {
      if (hasMobileArea(b.mobile)) b.mobile = { ...b.mobile, row: a.row, rows: a.rows };
    } else b.pos = { ...placeOf(b.pos), row: a.row, rows: a.rows };
  });
}

/**
 * The gap a linked block has when its first row is `row`, its leader where `flow` says it is
 * now (or its stored area): rows between the leader's bottom and it (negative: overlapping).
 */
function gapAt(section, link, row, flow = {}, phone = false) {
  const lead = section.blocks.find((b) => b.id === link.to);
  if (!lead) return link.gap;
  const a = flow[lead.id] || (phone ? phoneAreaOf(lead) : placeOf(lead.pos));
  return row - (a.row + a.rows);
}

/**
 * Block `j` of section `at` placed at `pos` (the section grows to fit it): one undo step (a
 * drag); key: typing in a number field coalesces (see writeSection). flow: where the other
 * blocks are now (storeFlow).
 */
export function placeBlock(store, file, at, j, pos, key, { flow, rows = 0 } = {}) {
  const section = listOf(store, file)[at];
  storeFlow(section, j, flow);
  const b = section.blocks[j];
  b.pos = placeOf(pos);
  // a linked block moved: its gap changes, it keeps following its leader
  const l = linkOf(b);
  if (l) b.link = { to: l.to, gap: gapAt(section, l, b.pos.row, flow) };
  grow(section, Math.max(rows, rowsOf(section)));
  return writeSection(store, file, at, section, key);
}

/**
 * Block `j` of section `at` follows block `to` (its id, in the same section) with `gap` cells
 * between them, on the desktop grid or the phone grid (`phone`); to null: it is free again.
 * Refused (null) when `to` isn't in the section or the link makes a loop; false when nothing
 * changed. One undo step.
 * On the phone, a block without a phone area of its own gets one (its desktop area halved,
 * where it shows now), so its phone link is its own.
 */
export function linkBlock(store, file, at, j, to, gap = 0, { phone = false, row } = {}) {
  const section = listOf(store, file)[at];
  const b = section.blocks[j];
  if (!b) return null;
  if (to !== null) {
    if (to === b.id || !section.blocks.some((x) => x.id === to)) return null;
    if (!Number.isInteger(gap)) return null;
  }
  const next = to === null ? undefined : { to, gap };
  // unlinked: it stays on the row it shows (`row`), not the one stored with its old leader's
  // stored rows (an auto leader's content may span more)
  const stay = !next && Number.isInteger(row) && row > 0 ? { row } : {};
  if (phone) {
    if (!hasMobileArea(b.mobile)) setMobile(b, phoneAreaOf(b));
    setMobile(b, { link: next, ...stay });
  } else if (next) b.link = next;
  else {
    delete b.link;
    if (stay.row && b.pos) b.pos = { ...b.pos, row: stay.row };
  }
  if (next && makesLoop(section.blocks, b.id, to, phone)) return null;
  return writeSection(store, file, at, section);
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
 * Block `j` of section `at` placed at `area` on the phone grid (60 columns): its own phone area
 * from then on (the first time, its desktop link comes along as its phone link, the gap
 * halved). A linked block's gap follows where it was put. One undo step; key: see writeSection.
 */
export function placeMobile(store, file, at, j, area, { key, flow, rows = 0 } = {}) {
  const section = listOf(store, file)[at];
  storeFlow(section, j, flow, true);
  const b = section.blocks[j];
  const inherited = !hasMobileArea(b.mobile) ? linkOf(b, true) : null;
  setMobile(b, placeOf(area, MCOLS));
  if (inherited) setMobile(b, { link: inherited });
  const l = linkOf(b, true);
  if (l) setMobile(b, { link: { to: l.to, gap: gapAt(section, l, b.mobile.row, flow, true) } });
  grow(section, Math.max(rows, mobileRowsOf(section)), true);
  return writeSection(store, file, at, section, key);
}

/** Block `j`'s placement on phones ('none' or undefined: in the flow). */
export function placeOnPhone(store, file, at, j, place) {
  const section = listOf(store, file)[at];
  setMobile(section.blocks[j], { place: place && place !== 'none' ? place : undefined });
  return writeSection(store, file, at, section);
}

/**
 * Section `at` back to its desktop layout on phones (halved): its blocks' phone areas, phone
 * links and phone placements removed.
 */
export function resetMobile(store, file, at) {
  const section = listOf(store, file)[at];
  if (!section.blocks.some((b) => b.mobile)) return false;
  for (const b of section.blocks) delete b.mobile;
  return writeSection(store, file, at, section);
}
