/**
 * Motion tokens — the single source of truth for animation values across the app.
 *
 * Values come straight from the `apple-design` and `animate-expo` skills:
 *   - Springs use Apple's two designer parameters (`duration` + `dampingRatio`), never
 *     mass/stiffness/damping. `dampingRatio: 1` is critically damped (no overshoot);
 *     drop to ~0.8 only when the gesture itself carried momentum (a flick, a drag release).
 *   - Easings are the strong curves the skills prescribe — RN/CSS built-ins are too weak.
 *   - `ease-in` is never used on UI (it delays the moment the user is watching).
 *
 * Reanimated's `withSpring` accepts the `{ duration, dampingRatio }` form directly.
 */
import { Easing } from 'react-native-reanimated';

// --- Springs (anything a finger touched) -------------------------------------------------

/** Default settle, no overshoot. Menus, cards, most repositioning. */
export const SPRING_DEFAULT = { duration: 400, dampingRatio: 1 } as const;

/** Slight overshoot — only after a momentum gesture (flick / drag release / snap-back). */
export const SPRING_MOMENTUM = { duration: 400, dampingRatio: 0.8 } as const;

/** Sheets, drawers, overlay cards. */
export const SPRING_SHEET = { duration: 300, dampingRatio: 0.8 } as const;

// --- Easings (everything without a finger on it) ----------------------------------------

/** Strong ease-out for entering / exiting UI. */
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
/** On-screen movement / morphing (an indicator sliding across). */
export const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
/** iOS sheet curve. */
export const EASE_SHEET = Easing.bezier(0.32, 0.72, 0, 1);

/** CSS-transition string form of `EASE_OUT`, for Reanimated style transitions. */
export const EASE_OUT_CSS = 'cubic-bezier(0.23, 1, 0.32, 1)';

// --- Durations (ms) --------------------------------------------------------------------

export const DUR_PRESS = 120; // press feedback — the ceiling for something touched constantly
export const DUR_TOGGLE = 180; // chip / small state change / indicator move
export const DUR_ENTER = 250; // an element arriving
export const DUR_TOAST_IN = 300;
export const DUR_TOAST_OUT = 240; // exit ~20% faster than entry

/** Per-index delay for a staggered list entrance. 30–80ms reads as a cascade; outside that it drags or looks simultaneous. */
export const STAGGER = 45;

// --- Worklets (gesture physics) -------------------------------------------------------

/**
 * Where a flick would come to rest if it kept decelerating — Apple's exponential-decay
 * form from *Designing Fluid Interfaces* (not the `v²/2a` from physics class). Use it to
 * decide whether a swipe commits, so a fast short flick counts and a slow long drag doesn't.
 */
export function project(velocity: number, decelerationRate = 0.998): number {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/**
 * Progressive resistance past a boundary — the further past the edge, the less the element
 * follows. A hard stop reads as "frozen"; this reads as "responsive, nothing more here".
 */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  'worklet';
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
