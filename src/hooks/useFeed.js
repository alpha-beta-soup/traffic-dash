import { useEffect, useState } from 'react';

import { fetchJson } from '../utils';

const keep = data => data;

// Polls a feed from the server (`url`) every `refresh` ms, while `enabled`: { data, updated, failed },
// updated being when it last loaded (ms; null before then) and failed whether its latest try
// failed. A failure keeps the last data loaded. `select` picks what's kept from what's loaded:
// give one that's the same each render (e.g. defined outside the component).
export default function useFeed(url, refresh, { enabled = true, initial = [], select = keep } = {}) {
  const [feed, setFeed] = useState({ data: initial, updated: null, failed: false });
  useEffect(() => {
    if (!enabled) return undefined;
    const load = () => fetchJson(url)
      .then(data => setFeed({ data: select(data), updated: Date.now(), failed: false }))
      .catch((err) => {
        console.error(`${url}: ${err.message}`);
        setFeed(current => ({ ...current, failed: true }));
      });
    load();
    const timer = setInterval(load, refresh);
    return () => clearInterval(timer);
  }, [url, refresh, enabled, select]);
  return feed;
}
