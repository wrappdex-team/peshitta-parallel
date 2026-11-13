/** Put the start of a spoken line under the header, not in the lower half. */
export function scrollLineToTop(el: HTMLElement) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const header = document.querySelector("header");
  const tongue = document.querySelector("[data-reading-tongue]");
  const top =
    window.scrollY +
    el.getBoundingClientRect().top -
    (header?.getBoundingClientRect().height ?? 0) -
    (tongue?.getBoundingClientRect().height ?? 0) -
    12;
  window.scrollTo({ top: Math.max(0, top), left: 0, behavior: reduced ? "auto" : "smooth" });
}
