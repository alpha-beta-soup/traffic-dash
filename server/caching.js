// The server's in-memory caches of upstream feeds: memo (refetched when stale) and stale (served
// stale while refetched), optionally kept on disk across restarts (stored.js)
import { readStored, writeStored } from './stored.js';

// Small in-memory cache so many browser tabs don't hammer the upstream feeds.
// Caching the promise means concurrent callers share one request.
export const memo = (ttl, fn) => {
  let promise;
  let expires = 0;
  return () => {
    if (Date.now() > expires) {
      promise = fn();
      expires = Date.now() + ttl;
      promise.catch(() => { expires = 0; }); // Retry on next call rather than caching the failure
    }
    return promise;
  };
};

// Like memo, but once there's a value it's served as is while a newer one is fetched in the
// background; a failed refresh keeps the old value (and is tried again next time). With `stored`
// (a name), each value is also saved to disk (server/stored.js), and the last one saved is where
// it starts after a restart, rather than with nothing until the first fetch.
export const stale = (ttl, fn, { stored, read = readStored, write = writeStored } = {}) => {
  let value;
  let fetched = 0;
  let pending = null;
  const refresh = () => {
    pending ??= fn()
      .then((result) => {
        value = result;
        fetched = Date.now();
        if (stored) write(stored, { fetched, value }).catch(err => console.error(`Saving ${stored}: ${err.message}`));
      })
      .finally(() => { pending = null; });
    return pending;
  };
  let loading = stored && read(stored).then((saved) => {
    if (saved && value === undefined) ({ value, fetched } = saved);
  });
  return async () => {
    if (loading) {
      await loading;
      loading = null;
    }
    if (value === undefined) await refresh();
    else if (Date.now() - fetched > ttl) refresh().catch(err => console.error(`Refreshing: ${err.message}`));
    return value;
  };
};
