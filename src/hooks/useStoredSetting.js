import { useEffect, useState } from 'react';

const PREFIX = 'traffic-dash:';

const load = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(PREFIX + key)) ?? fallback;
  } catch {
    return fallback;
  }
};

// useState, remembered in this browser between visits. If storage isn't available (e.g. a
// private window), the setting still works for the session. `merge` combines a saved value
// with the fallback, e.g. so a newly added option starts at its default.
export default function useStoredSetting(key, fallback, merge = (_, saved) => saved) {
  const [value, setValue] = useState(() => {
    const saved = load(key, undefined);
    return saved === undefined ? fallback : merge(fallback, saved);
  });
  useEffect(() => {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // Not saved; it still applies for this session
    }
  }, [key, value]);
  return [value, setValue];
}
