import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { Flip } from 'gsap/Flip';

gsap.registerPlugin(ScrollTrigger, SplitText, Flip);

export { gsap, ScrollTrigger, SplitText, Flip };

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const finePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/** querySelectorAll over the current view AND the #portal layer (fixed UI moved out of the view). */
export const $$ = (view, sel) => [
  ...view.querySelectorAll(sel),
  ...document.querySelectorAll(`#portal ${sel}`),
];
export const $ = (view, sel) => $$(view, sel)[0] || null;
