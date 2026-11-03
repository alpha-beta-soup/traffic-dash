import { useEffect, useState } from 'react';

// Whether the element `ref` points to is on screen, or within `margin` of it: { onScreen, seen },
// seen staying true once it has been. For work worth doing only for what can be seen.
export default function useOnScreen(ref, margin = '300px') {
  const [onScreen, setOnScreen] = useState(false);
  const [seen, setSeen] = useState(false);
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
  return { onScreen, seen };
}
