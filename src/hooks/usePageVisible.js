import { useSyncExternalStore } from 'react';

const subscribe = (onChange) => {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
};

// Whether the page can be seen: not in a background tab, a minimised window, or a phone with its
// screen off. For work worth doing only while someone could be looking.
export default function usePageVisible() {
  return useSyncExternalStore(subscribe, () => document.visibilityState !== 'hidden');
}
