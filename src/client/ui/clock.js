/**
 * The site's local time in every [data-clock="<time zone>"] (settings/site.json "timezone",
 * e.g. "Europe/Amsterdam"); no or an unknown zone shows the visitor's own time.
 */
const formats = new Map();

function format(zone) {
  if (!formats.has(zone)) {
    const opts = { hour: '2-digit', minute: '2-digit' };
    let fmt;
    try {
      fmt = new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: zone || undefined });
    } catch {
      fmt = new Intl.DateTimeFormat('en-GB', opts); // not a time zone
    }
    formats.set(zone, fmt);
  }
  return formats.get(zone);
}

export function updateClocks() {
  const now = new Date();
  document
    .querySelectorAll('[data-clock]')
    .forEach((el) => (el.textContent = format(el.dataset.clock).format(now)));
}

export function initClock() {
  updateClocks();
  setInterval(updateClocks, 15000);
}
