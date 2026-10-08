/** Local time in the Netherlands for every [data-clock]. */
const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Amsterdam',
  hour: '2-digit',
  minute: '2-digit',
});

export function updateClocks() {
  const now = fmt.format(new Date());
  document.querySelectorAll('[data-clock]').forEach((el) => (el.textContent = now));
}

export function initClock() {
  updateClocks();
  setInterval(updateClocks, 15000);
}
