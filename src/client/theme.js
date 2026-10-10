/** Album accent: tween the --accent CSS variable (tints glass + background glow). */
import { gsap, reducedMotion } from './lib/env.js';
import { transitions } from './anim/engine.js';

export function applyAccent(color, { instant = false } = {}) {
  if (!color) return;
  const root = document.documentElement;
  const t = transitions.accent;
  if (instant || reducedMotion()) return gsap.set(root, { '--accent': color });
  gsap.to(root, { '--accent': color, duration: t.duration, ease: t.ease, overwrite: true });
}
