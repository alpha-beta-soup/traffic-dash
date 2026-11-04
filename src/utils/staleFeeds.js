// Which of the page's feeds are out of date, to say so rather than quietly show old data: those
// whose latest try failed, or whose last load is well overdue (more than twice their refresh, and
// a minute's grace: browsers slow the timers of a tab in the background)
const GRACE = 60_000;

// feeds: [{ name, refresh (ms), updated (ms or null), failed }] → those out of date
export default function staleFeeds(feeds, now) {
  return feeds.filter(({ refresh, updated, failed }) => failed
    || (updated !== null && now - updated > 2 * refresh + GRACE));
}
