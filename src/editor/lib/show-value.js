/**
 * An attachment that shows `text` in an input, except while the user is typing in it (focused):
 * {@attach showValue(String(value ?? ''))}. A new text runs it again (Svelte re-attaches).
 */
export const showValue = (text) => (el) => {
  if (document.activeElement !== el && el.value !== text) el.value = text;
};
