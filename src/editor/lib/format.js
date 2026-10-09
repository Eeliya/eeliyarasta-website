/** Small text helpers shared by the editor's JS and Svelte files. */

/** Modifier key name for shortcuts: ⌘ on Apple devices, Ctrl elsewhere. */
export const MOD = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

/** plural(1, 'file') -> "1 file", plural(3, 'file') -> "3 files" */
export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
