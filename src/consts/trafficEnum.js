// https://www.mapbox.com/vector-tiles/mapbox-traffic-v1/
module.exports = Object.freeze({
  motorway: {value: 0, description: 'High-speed, grade-separated highway'},
  motorway_link: {value: 0.5, description: 'Interchange or on & off ramp'},
  trunk: {value: 1, description: 'Main road'},
  trunk_link: {value: 1.5, description: 'Main road'},
  primary: {value: 3, description: 'Major road'},
  primary_link: {value: 3.5, description: 'Major road'},
  secondary: {value: 4, description: 'Road'},
  secondary_link: {value: 4.5, description: 'Road'},
  tertiary: {value: 5, description: 'Link road between centres'},
  tertiary_link: {value: 5.5, description: 'Link road between centres'},
  link: {value: 6, description: 'Link road'},
  street: {value: 7, description: 'Street'},
  service: {value: 8, description: 'Service lane'}
})
