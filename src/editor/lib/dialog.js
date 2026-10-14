/**
 * A modal <dialog>'s backdrop closes it: {@attach closeOnBackdrop}. A click on the backdrop
 * lands on the dialog itself (Esc closes a modal dialog by itself).
 */
export function closeOnBackdrop(dialog) {
  const close = (e) => e.target === dialog && dialog.close();
  dialog.addEventListener('click', close);
  return () => dialog.removeEventListener('click', close);
}
