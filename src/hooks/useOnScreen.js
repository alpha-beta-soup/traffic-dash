import { useEffect, useState } from 'react';

import usePageVisible from './usePageVisible';

// Whether the element `ref` points to is on screen, or within `margin` of it: { onScreen, seen },
// seen staying true once it has been. For work worth doing only for what can be seen, so not
// while the page is hidden (e.g. in a background tab).
export default function useOnScreen(ref, margin = '300px') {
  const [onScreen, setOnScreen] = useState(false);
  const [seen, setSeen] = useState(false);
  const visible = usePageVisible();
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      setOnScreen(entry.isIntersecting);
      if (entry.isIntersecting) setSeen(true);
    }, { rootMargin: margin });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, margin]);
  return { onScreen: onScreen && visible, seen };
}
