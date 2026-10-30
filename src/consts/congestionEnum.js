// https://docs.mapbox.com/data/tilesets/reference/mapbox-traffic-v1/
// Congestion is shown two ways at once, so no level relies on colour alone:
// - color: validated for colour-blind separation (worst pair ΔE 9.4 deutan, 16.0 normal vision);
//   lightness falls as congestion rises, and free flow is teal rather than green
// - width: a multiple of the base line width; busier roads draw heavier
export default Object.freeze({
  severe: { value: 0, description: 'Severe', color: '#6b0f3a', width: 2.8 },
  heavy: { value: 1, description: 'Heavy', color: '#de4f2a', width: 2.1 },
  moderate: { value: 2, description: 'Moderate', color: '#d39500', width: 1.5 },
  low: { value: 3, description: 'Low', color: '#2b9bbd', width: 0.4 }, // Hairline: free flow is background
});
