// Road event impacts, most serious first. Shapes follow NZ road signs: a red no-entry circle
// for closures, and warning diamonds, orange for delays and yellow for caution.
export default Object.freeze({
  'Road Closed': { label: 'Road closed', color: '#d32f2f', shape: 'no-entry', rank: 0 },
  Delays: { label: 'Delays', color: '#ef6c00', shape: 'diamond', rank: 1 },
  'Vehicle Restrictions': { label: 'Vehicle restrictions', color: '#1565c0', shape: 'info', rank: 2 },
  Caution: { label: 'Caution', color: '#f2b705', shape: 'diamond', rank: 3 },
});
