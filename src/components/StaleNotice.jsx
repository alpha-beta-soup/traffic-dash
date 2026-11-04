import Alert from '@mui/material/Alert';

import useNow from '../hooks/useNow';
import { staleFeeds } from '../utils';

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: 'Pacific/Auckland' });

// "a, b and c"
const list = names => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0]);

// Says which feeds are out of date (see staleFeeds), and that what's shown is from before: e.g.
// "Couldn't update road events (last loaded 1:05 pm) and message signs". Nothing while they're
// all current.
export default function StaleNotice({ feeds }) {
  const now = useNow(30_000); // Also notices a feed falling overdue between its loads
  const stale = staleFeeds(feeds, now);
  if (!stale.length) return null;
  const names = stale.map(({ name, updated }) => (updated ? `${name} (last loaded ${timeFormat.format(updated)})` : name));
  return (
    <Alert severity="warning" sx={{ mx: 1, mt: 1, py: 0 }}>
      Couldn&apos;t update {list(names)}: showing what was loaded before, and trying again.
    </Alert>
  );
}
