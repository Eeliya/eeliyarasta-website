// A photo list's Add photo in the Media window (MediaModal.svelte, multi-pick).
/** A photo list with `keys` appended, in order: each a new item (`item`, its `photo` set). */
export function appendPhotos(list, keys, { item = '', photo = '' } = {}) {
  const items = keys.map((k) => (photo ? { ...JSON.parse(JSON.stringify(item)), [photo]: k } : k));
  return [...(Array.isArray(list) ? list : []), ...items];
}
