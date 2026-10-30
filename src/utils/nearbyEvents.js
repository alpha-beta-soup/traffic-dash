import { distanceTo } from './geometry';

const NEARBY = 500; // metres
// Caution events are most of them (roadworks with a speed limit, and so on): too common to flag
export const DISRUPTIVE = ['Road Closed', 'Delays'];

// The disruptive road events within NEARBY of a camera, closures first, then nearest
export default function nearbyEvents(camera, events) {
  return events
    .filter(event => DISRUPTIVE.includes(event.impact))
    .map(event => ({ event, distance: distanceTo(camera, event.geometry) }))
    .filter(({ distance }) => distance <= NEARBY)
    .sort((a, b) => DISRUPTIVE.indexOf(a.event.impact) - DISRUPTIVE.indexOf(b.event.impact) || a.distance - b.distance)
    .map(({ event }) => event);
}
