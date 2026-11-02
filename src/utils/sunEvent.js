// Sunrise and sunset matter to drivers only around them: a low sun brings sunstrike, and the
// hours around sunrise are the coldest, for frost
export const SUN_WINDOW = 2 * 60 * 60; // s either side

// OpenWeatherMap's sys ({ sunrise, sunset }: Unix seconds, today's) to the one within SUN_WINDOW
// of `now` (Unix seconds): { type: 'sunrise' | 'sunset', time }, or null if neither is near
export default function sunEvent(sys, now = Date.now() / 1000) {
  const near = ['sunrise', 'sunset']
    .filter(type => typeof sys?.[type] === 'number')
    .map(type => ({ type, time: sys[type], away: Math.abs(sys[type] - now) }))
    .filter(({ away }) => away <= SUN_WINDOW)
    .sort((a, b) => a.away - b.away);
  return near.length ? { type: near[0].type, time: near[0].time } : null;
}
