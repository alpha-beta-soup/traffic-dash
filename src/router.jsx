// A very small router: the dashboard at /, and a page per camera at /camera/<id>. Uses the
// browser's history, so Back, bookmarks and opening links in new tabs all work.
import { useEffect, useState } from 'react';
import MuiLink from '@mui/material/Link';

const listeners = new Set();

export function navigate(path) {
  if (path === window.location.pathname) return;
  window.history.pushState(null, '', path);
  listeners.forEach(listener => listener());
  window.scrollTo(0, 0);
}

export function usePath() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    listeners.add(update);
    window.addEventListener('popstate', update);
    return () => {
      listeners.delete(update);
      window.removeEventListener('popstate', update);
    };
  }, []);
  return path;
}

export { cameraPath, matchRoute } from './routes';

// A real link (so middle-click, Ctrl-click and "open in new tab" work as usual) that navigates
// within the app on a plain click
export function Link({ to, onClick, ...props }) {
  const handleClick = (event) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(to);
  };
  return <a href={to} onClick={handleClick} {...props} />;
}

// A Link styled as text, in the theme's link colours
export const TextLink = props => <MuiLink component={Link} {...props} />;
