const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const plural = (n, unit) => `${n} ${unit}${n === 1 ? '' : 's'} ago`;

// Deliberately approximate: cameras only update about once a minute
export default function timeAgo(date, now = Date.now()) {
  // NZTA cameras sometimes report times slightly in the future
  const seconds = Math.max(0, (now - date) / 1000);
  if (seconds < 30) return 'less than a minute ago';
  if (seconds < 90) return 'about a minute ago';
  if (seconds < 45 * MINUTE) return plural(Math.round(seconds / MINUTE), 'minute');
  if (seconds < 90 * MINUTE) return 'about an hour ago';
  if (seconds < DAY) return plural(Math.round(seconds / HOUR), 'hour');
  return plural(Math.round(seconds / DAY), 'day');
}
