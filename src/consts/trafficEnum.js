// https://docs.mapbox.com/data/tilesets/reference/mapbox-traffic-v1/
// value: importance (lower is more important); minzoom: when the map starts drawing it.
// Streets and below are neither drawn nor used to match cameras.
export const MATCHABLE_CLASS = 6; // Up to and including 'link'; not streets or service lanes
export default Object.freeze({
  motorway: { value: 0, minzoom: 0, description: 'High-speed, grade-separated highway' },
  motorway_link: { value: 0.5, minzoom: 0, description: 'Interchange or on & off ramp' },
  trunk: { value: 1, minzoom: 0, description: 'Main road' },
  trunk_link: { value: 1.5, minzoom: 0, description: 'Main road' },
  primary: { value: 3, minzoom: 12, description: 'Major road' },
  primary_link: { value: 3.5, minzoom: 12, description: 'Major road' },
  secondary: { value: 4, minzoom: 12, description: 'Road' },
  secondary_link: { value: 4.5, minzoom: 12, description: 'Road' },
  tertiary: { value: 5, minzoom: 15, description: 'Link road between centres' },
  tertiary_link: { value: 5.5, minzoom: 15, description: 'Link road between centres' },
  link: { value: 6, minzoom: 15, description: 'Link road' },
  street: { value: 7, description: 'Street' },
  street_limited: { value: 7.5, description: 'Street with restricted access' },
  service: { value: 8, description: 'Service lane' },
});
