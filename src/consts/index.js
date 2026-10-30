export { default as congestionEnum } from './congestionEnum';
export { default as trafficEnum } from './trafficEnum';
export { default as descriptionReplace } from './descriptionReplace';

// Loops replay the last ANIMATION_WINDOW at ANIMATION_SPEEDUP (so a minute plays in 300ms),
// all in sync: see utils/loopClock.js
export const ANIMATION_WINDOW = 30 * 60_000; // ms
export const ANIMATION_SPEEDUP = 200;
export const ANIMATION_HOLD = 1500; // ms to hold the present before looping
// Crossfade for the loop restart and live updates only: between loop frames
// (a minute apart) a fade would just ghost the moving traffic
export const ANIMATION_FADE = 400; // ms
export const BLACK = '#113654';
export const LIGHTBLACK = '#485d6f';
export const MAX_CAMERAS_IN_VIEW = 10;
export const TRAFFIC_REFRESH = 5 * 60_000; // ms; Mapbox updates traffic roughly this often

// Randomised per camera, so they don't all hit the server at once
export const MIN_REFRESH = Number(import.meta.env.VITE_MIN_REFRESH) || 10000;
export const MAX_REFRESH = Number(import.meta.env.VITE_MAX_REFRESH) || 25000;
