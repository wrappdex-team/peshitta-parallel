/** Put the verse, number included, in the open band above the Read bar. */
export function scrollLineToTop(el: HTMLElement) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const header = document.querySelector("header");
  const tongue = document.querySelector("[data-reading-tongue]");
  const bar = document.querySelector("[data-read-bar]");
  const headerBottom = header?.getBoundingClientRect().bottom ?? 0;
  const tongueBox = tongue?.getBoundingClientRect();
  const tongueShown =
    !!tongue && !!tongueBox && tongueBox.height > 1 && getComputedStyle(tongue).display !== "none";
  const stack = Math.max(headerBottom, tongueShown ? tongueBox.bottom : 0);
  const barTop = bar ? bar.getBoundingClientRect().top : window.innerHeight;
  const bandTop = stack + 8;
  // Header offset keeps the number below the sticky stack. Bar top is the
  // bottom of the band, including the taller bar after More opens.
  const room = barTop - bandTop;
  const anchor = room > 0 ? bandTop : Math.max(0, barTop - 8);
  const top = window.scrollY + el.getBoundingClientRect().top - anchor;
  window.scrollTo({ top: Math.max(0, top), left: 0, behavior: reduced ? "auto" : "smooth" });
}