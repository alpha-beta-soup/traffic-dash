import { eventImpacts } from '../consts';
import { distanceTo } from './geometry';

// Caution events are most of them (roadworks with a speed limit, and so on): too common to flag
// on cards, so by default only these count
export const DISRUPTIVE = ['Road Closed', 'Delays'];

// The road events within `radius` metres of a camera, most serious first, then nearest
export default function nearbyEvents(camera, events, { radius = 500, impacts = DISRUPTIVE } = {}) {
  const rank = event => eventImpacts[event.impact]?.rank ?? Infinity;
  return events
    .filter(event => impacts.includes(event.impact))
    .map(event => ({ event, distance: distanceTo(camera, event.geometry) }))
    .filter(({ distance }) => distance <= radius)
    .sort((a, b) => rank(a.event) - rank(b.event) || a.distance - b.distance)
    .map(({ event }) => event);
}
