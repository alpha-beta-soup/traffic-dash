import { useRef } from 'react';

// A ref that always holds the latest value, for callbacks registered once (e.g. on a map)
export default function useLatest(value) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
