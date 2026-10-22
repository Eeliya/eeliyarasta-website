// The Quote widget on the page: .is-seen once it has scrolled into view.
export default function quote(el) {
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) el.querySelector('.quote')?.classList.add('is-seen');
  });
  io.observe(el);
  return () => io.disconnect();
}
