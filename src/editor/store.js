/**
 * In-memory copies of content/*.json with dirty tracking and undo/redo.
 *
 *   base[file]    - the version last loaded from / saved to the source (disk or GitHub)
 *   current[file] - the edited version shown in the preview
 *
 * Every change is { file, ptr, before, after } (after === undefined removes the value).
 * Rapid changes with the same `key` (typing in one field) coalesce into one undo step.
 */
import { get, set, remove } from './lib/pointer.js';
import { clone, equal, diff, patch } from './lib/diff.js';
import { formatJSON } from './lib/json-format.js';

export function createStore() {
  const base = {};
  const current = {};
  const listeners = new Set();
  let history = [];
  let future = [];
  let batchEntry = null;

  const emit = (files, source) => listeners.forEach((fn) => fn({ files: [...new Set(files)], source }));

  const write = (c, value) => {
    if (value === undefined) remove(current[c.file], c.ptr, { keep: c.keep || 0 });
    else set(current[c.file], c.ptr, clone(value));
  };

  function commitEntry(entry, { source } = {}) {
    const last = history.at(-1);
    if (entry.key && last && last.key === entry.key && Date.now() - last.t < 1000 && last.changes.length === 1 && entry.changes.length === 1) {
      last.changes[0].after = entry.changes[0].after;
      last.t = Date.now();
    } else history.push(entry);
    if (history.length > 300) history.shift();
    future = [];
    emit(entry.changes.map((c) => c.file), source);
  }

  const store = {
    base,
    current,
    load(files) {
      for (const [name, data] of Object.entries(files)) {
        base[name] = clone(data);
        current[name] = clone(data);
      }
      history = [];
      future = [];
      emit(Object.keys(files), 'load');
    },
    get: (file, ptr) => get(current[file], ptr),
    getBase: (file, ptr) => get(base[file], ptr),

    /** Set (or with value === undefined, remove) a value. */
    set(file, ptr, value, { key, keep = 0, source } = {}) {
      const before = clone(get(current[file], ptr));
      if (equal(before, value)) return false;
      const change = { file, ptr, before, after: clone(value), keep };
      write(change, value);
      if (batchEntry) batchEntry.changes.push(change);
      else commitEntry({ changes: [change], key, t: Date.now() }, { source });
      return true;
    },
    remove(file, ptr, opts) {
      return store.set(file, ptr, undefined, opts);
    },
    /** Group several set() calls into one undo step. */
    batch(fn, { source } = {}) {
      batchEntry = { changes: [], t: Date.now() };
      try {
        fn();
      } finally {
        const entry = batchEntry;
        batchEntry = null;
        if (entry.changes.length) commitEntry(entry, { source });
      }
    },
    undo() {
      const entry = history.pop();
      if (!entry) return false;
      [...entry.changes].reverse().forEach((c) => write(c, c.before));
      future.push(entry);
      emit(entry.changes.map((c) => c.file), 'undo');
      return true;
    },
    redo() {
      const entry = future.pop();
      if (!entry) return false;
      entry.changes.forEach((c) => write(c, c.after));
      history.push(entry);
      emit(entry.changes.map((c) => c.file), 'redo');
      return true;
    },
    canUndo: () => history.length > 0,
    canRedo: () => future.length > 0,

    dirtyFiles: () => Object.keys(current).filter((f) => formatJSON(current[f]) !== formatJSON(base[f])),
    /** Leaf changes per file, for the "changes" list. */
    changes: (file) => diff(base[file], current[file]),
    serialize: (file) => formatJSON(current[file]),

    /** The source now holds `files` (after a save): they become the new base. */
    markSaved(files) {
      for (const f of files) base[f] = clone(current[f]);
      emit(files, 'saved');
    },
    /**
     * A newer remote version arrived: make it the base and re-apply our local
     * edits on top of it. Returns the files whose remote differed from our base.
     */
    rebase(remote) {
      const moved = [];
      for (const [f, data] of Object.entries(remote)) {
        if (equal(data, base[f])) continue;
        moved.push(f);
        const ops = diff(base[f], current[f]);
        base[f] = clone(data);
        current[f] = patch(data, ops);
      }
      if (moved.length) {
        history = [];
        future = [];
        emit(moved, 'rebase');
      }
      return moved;
    },
    discard(files = Object.keys(current)) {
      for (const f of files) current[f] = clone(base[f]);
      history = [];
      future = [];
      emit(files, 'discard');
    },
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  return store;
}
