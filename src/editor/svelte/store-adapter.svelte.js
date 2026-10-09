/**
 * Thin reactive view of the editor store (src/editor/store.js) for Svelte components.
 * The store stays as it is: plain objects plus an `on()` event. Every store event bumps
 * `version`; reads go through it, so Svelte re-runs whatever used them.
 */
const copy = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));

export function storeAdapter(store) {
  let version = $state(0);
  const off = store.on(() => version++);
  return {
    /** A fresh copy of a file's edited value (fresh objects: Svelte sees in-place edits). */
    current(file) {
      version;
      return copy(store.current[file]);
    },
    /** A fresh copy of a file's last saved value. */
    base(file) {
      version;
      return copy(store.base[file]);
    },
    destroy: off,
  };
}
